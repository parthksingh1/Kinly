"""Background scheduler (runs inside the companion server).

Every 30 seconds:
- places check-in calls at each elder's chosen local times (respecting time zones and plan),
- retries unanswered calls, then alerts the family ("Mom didn't pick up her 10am call"),
- pushes medicine reminders to the elder's screen, marks doses missed, escalates repeat misses,
- sends the daily summary in the evening.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta
from typing import Optional

from loguru import logger

from .. import db, repo
from ..brain import summary
from ..db import from_db_dt, now_utc
from ..hub import hub
from ..notify import notifier
from ..settings import settings
from .bolna import bolna

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
DAILY_SUMMARY_HOUR = 20


class Scheduler:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._warned_bolna = False

    def start(self) -> None:
        if self._task is None and settings.scheduler_enabled:
            self._task = asyncio.create_task(self._loop())
            logger.info("Kinly scheduler started")

    async def _loop(self) -> None:
        while True:
            try:
                await self.tick()
            except Exception as e:
                logger.exception(f"Scheduler tick failed: {e}")
            await asyncio.sleep(30)

    async def tick(self, now: Optional[datetime] = None) -> None:
        for elder in repo.list_elders():
            if elder.get("consentStatus") == "declined":
                continue
            await self._checkin_calls(elder, now)
            await self._medicines(elder, now)
            await self._daily_summary(elder, now)
        await self._retries(now)

    # ----------------------------------------------------------- calls

    async def _checkin_calls(self, elder: dict, now: Optional[datetime]) -> None:
        if not elder.get("phone") or not repo.has_feature(elder, "checkin_call"):
            return
        local = (now or now_utc()).astimezone(repo.elder_tz(elder))
        schedules = db.query("SELECT * FROM call_schedules WHERE elderId = ? AND enabled = 1 ORDER BY timeLocal", [elder["id"]])
        if not repo.has_feature(elder, "multi_calls"):
            schedules = schedules[:1]
        else:
            schedules = schedules[:3]
        for sched in schedules:
            days = sched["days"].lower()
            if days != "daily" and WEEKDAYS[local.weekday()] not in days:
                continue
            hh, mm = (int(x) for x in sched["timeLocal"].split(":")[:2])
            slot = local.replace(hour=hh, minute=mm, second=0, microsecond=0)
            if not (slot <= local < slot + timedelta(minutes=3)):
                continue
            exists = db.query_one(
                "SELECT id FROM phone_calls WHERE elderId = ? AND reason = 'checkin' AND scheduledFor = ?",
                [elder["id"], slot],
            )
            if exists:
                continue
            if not settings.bolna_enabled:
                if not self._warned_bolna:
                    logger.warning("Check-in call due but Bolna is not configured; skipping phone calls")
                    self._warned_bolna = True
                continue
            logger.info(f"Placing scheduled check-in call to {elder['name']} ({sched['timeLocal']} local)")
            await bolna.place_call(elder, "checkin", scheduled_for=slot, attempt=1)

    async def _retries(self, now: Optional[datetime]) -> None:
        now = now or now_utc()
        failed = db.query(
            """SELECT * FROM phone_calls WHERE direction = 'outbound' AND reason = 'checkin'
               AND status IN ('no-answer','busy','failed','canceled','error','stopped') AND error NOT LIKE 'handled%'""",
        )
        for call in failed:
            if "not configured" in (call.get("error") or ""):
                continue
            updated = from_db_dt(call["updatedAt"]) or now
            if now - updated < timedelta(minutes=settings.call_retry_minutes):
                continue
            elder = repo.get_elder(call["elderId"])
            if not elder:
                continue
            db.update("phone_calls", call["id"], {"error": f"handled: {call.get('error') or call['status']}"[:500]})
            if call["attempt"] <= settings.call_retry_count:
                logger.info(f"Retrying call to {elder['name']} (attempt {call['attempt'] + 1})")
                await bolna.place_call(elder, "checkin", scheduled_for=from_db_dt(call["scheduledFor"]), attempt=call["attempt"] + 1)
            else:
                await self.missed_call_alert(elder, call)

    async def missed_call_alert(self, elder: dict, call: dict) -> dict:
        name = elder.get("preferredName") or elder["name"]
        slot = (from_db_dt(call["scheduledFor"]) or now_utc()).astimezone(repo.elder_tz(elder))
        when = slot.strftime("%I:%M %p").lstrip("0").replace(":00 ", " ").lower()
        alert = repo.create_alert(
            elder["id"], "concerning", "missed_call", f"{name} didn't pick up the {when} call",
            f"Kinly tried {call['attempt']} time{'s' if call['attempt'] > 1 else ''}. You may want to give {name} a call.",
        )
        await notifier.alert(elder, alert)
        return alert

    # ----------------------------------------------------------- medicines

    async def _medicines(self, elder: dict, now: Optional[datetime]) -> None:
        if not repo.has_feature(elder, "reminders"):
            return
        local_now = (now or now_utc()).astimezone(repo.elder_tz(elder))
        for log in repo.todays_medicine_logs(elder):
            if log["status"] != "pending":
                continue
            due = log["scheduledLocal"]
            if due <= local_now < due + timedelta(minutes=2) and log["remindedCount"] == 0 and hub.is_online(elder["id"]):
                await self.push_reminder(elder, log)
            elif local_now >= due + timedelta(minutes=60):
                await self.mark_missed(elder, log)

    async def push_reminder(self, elder: dict, log: dict) -> int:
        return await hub.push(elder["id"], {
            "type": "kinly-reminder",
            "kind": "medicine",
            "logId": log["id"],
            "medicine": log["medicineName"],
            "dosage": log.get("dosage", ""),
            "time": log["scheduledLocal"].strftime("%H:%M"),
        })

    async def mark_missed(self, elder: dict, log: dict) -> Optional[dict]:
        repo.set_medicine_status(log["id"], "missed", "auto")
        recent = db.query(
            "SELECT status FROM medicine_logs WHERE medicineId = ? AND status IN ('taken','missed') ORDER BY scheduledFor DESC LIMIT ?",
            [log["medicineId"], settings.missed_med_escalate_after],
        )
        if len(recent) >= settings.missed_med_escalate_after and all(r["status"] == "missed" for r in recent):
            if repo.recent_alert_exists(elder["id"], "missed_medicine", 6 * 60):
                return None
            name = elder.get("preferredName") or elder["name"]
            alert = repo.create_alert(
                elder["id"], "concerning", "missed_medicine", f"{name} missed {log['medicineName']} {len(recent)} times in a row",
                f"Kinly reminded {name} but the last {len(recent)} doses of {log['medicineName']} were not confirmed. A gentle call could help.",
            )
            await notifier.alert(elder, alert)
            return alert
        return None

    # ----------------------------------------------------------- daily summary

    async def _daily_summary(self, elder: dict, now: Optional[datetime]) -> None:
        local = (now or now_utc()).astimezone(repo.elder_tz(elder))
        if local.hour != DAILY_SUMMARY_HOUR or not repo.has_feature(elder, "daily_summary"):
            return
        row = db.query_one("SELECT * FROM daily_summaries WHERE elderId = ? AND date = ?", [elder["id"], local.date().isoformat()])
        if row and row.get("sentAt"):
            return
        daily = await summary.update_daily_summary(elder)
        await self.send_daily(elder, daily)

    async def send_daily(self, elder: dict, daily: dict) -> None:
        name = elder.get("preferredName") or elder["name"]
        lines = [daily["summary"]]
        if daily.get("moodLabel"):
            lines.append(f"Mood: {daily['moodLabel']}")
        lines.append(f"Medicines: {daily.get('medsTaken', 0)} taken, {daily.get('medsMissed', 0)} missed")
        talk = db.loads(daily.get("talkAbout"), [])
        if talk:
            lines.append(f"Talk about this: {talk[0]}")
        await notifier.send_family(elder, f"{name}'s day with Kinly", "\n".join(lines))
        db.update("daily_summaries", daily["id"], {"sentAt": now_utc()})


scheduler = Scheduler()
