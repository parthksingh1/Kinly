"""Family notifications: WhatsApp (Meta Cloud API or Twilio) and email (Resend).

Every message is also written to the `notifications` table, so the dashboard shows an
outbox even when no provider keys are configured (status "logged").
"""

from __future__ import annotations

import html
import json
from typing import Optional

import httpx
from loguru import logger

from . import db, repo
from .settings import settings


class Notifier:
    async def _whatsapp(self, to: str, body: str) -> tuple[str, str, str]:
        """Returns (status, provider, error)."""
        to_digits = "".join(ch for ch in to if ch.isdigit())
        if not to_digits:
            return "failed", "", "no phone number"
        provider = settings.whatsapp_provider or ("meta" if settings.whatsapp_token else "twilio" if settings.twilio_account_sid else "")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                if provider == "meta" and settings.whatsapp_token and settings.whatsapp_phone_id:
                    r = await client.post(
                        f"https://graph.facebook.com/v21.0/{settings.whatsapp_phone_id}/messages",
                        headers={"Authorization": f"Bearer {settings.whatsapp_token}"},
                        json={"messaging_product": "whatsapp", "to": to_digits, "type": "text",
                              "text": {"preview_url": True, "body": body[:4000]}},
                    )
                elif provider == "twilio" and settings.twilio_account_sid and settings.twilio_auth_token:
                    sender = settings.twilio_whatsapp_from or "+14155238886"
                    r = await client.post(
                        f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
                        auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                        data={"From": f"whatsapp:{sender if sender.startswith('+') else '+' + sender}",
                              "To": f"whatsapp:+{to_digits}", "Body": body[:1500]},
                    )
                else:
                    return "logged", "none", "WhatsApp not configured"
            if r.status_code >= 300:
                return "failed", provider, f"{r.status_code}: {r.text[:300]}"
            return "sent", provider, ""
        except Exception as e:
            return "failed", provider, str(e)

    async def _email(self, to: str, subject: str, body: str) -> tuple[str, str, str]:
        if not to:
            return "failed", "", "no email"
        if not settings.resend_api_key:
            return "logged", "none", "Email not configured"
        paragraphs = "".join(f"<p style='margin:0 0 12px'>{html.escape(p)}</p>" for p in body.split("\n") if p.strip())
        markup = (
            "<div style='font-family:Georgia,serif;max-width:560px;margin:auto;padding:24px;color:#1c2321'>"
            f"<p style='font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#1f5c4f;margin:0 0 16px'>Kinly</p>"
            f"{paragraphs}<p style='font-size:13px;color:#5b6461;margin-top:24px'>"
            f"<a href='{settings.family_app_url}/dashboard' style='color:#1f5c4f'>Open the family dashboard</a></p></div>"
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(
                    "https://api.resend.com/emails",
                    headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                    json={"from": settings.email_from, "to": [to], "subject": subject, "html": markup, "text": body},
                )
            if r.status_code >= 300:
                return "failed", "resend", f"{r.status_code}: {r.text[:300]}"
            return "sent", "resend", ""
        except Exception as e:
            return "failed", "resend", str(e)

    def _log(self, family_id: str, elder_id: Optional[str], channel: str, recipient: str, subject: str,
             body: str, status: str, provider: str, error: str) -> None:
        db.insert("notifications", {
            "familyId": family_id, "elderId": elder_id, "channel": channel, "recipient": recipient,
            "subject": subject, "body": body, "status": status, "provider": provider, "error": error[:500],
        })

    async def send_family(self, elder: dict, subject: str, body: str, urgent: bool = False) -> int:
        """Send to every family member on their enabled channels. Returns deliveries attempted."""
        recipients = repo.family_recipients(elder["familyId"])
        sent = 0
        for r in recipients:
            if r.get("notifyWhatsapp") and r.get("phone"):
                status, provider, error = await self._whatsapp(r["phone"], f"{subject}\n\n{body}")
                self._log(elder["familyId"], elder["id"], "whatsapp", r["phone"], subject, body, status, provider, error)
                sent += 1
            if r.get("notifyEmail") and r.get("email"):
                status, provider, error = await self._email(r["email"], subject, body)
                self._log(elder["familyId"], elder["id"], "email", r["email"], subject, body, status, provider, error)
                sent += 1
        if not recipients:
            self._log(elder["familyId"], elder["id"], "dashboard", "family", subject, body, "logged", "none", "no recipients")
        logger.info(f"Notified family of {elder['name']}: {subject} ({sent} deliveries)")
        return sent

    async def alert(self, elder: dict, alert: dict) -> None:
        name = elder.get("preferredName") or elder["name"]
        icon = {"urgent": "URGENT", "concerning": "Check in"}.get(alert["severity"], "Update")
        subject = f"{icon}: {alert['title']} ({name})"
        lines = [alert.get("detail") or ""]
        if alert.get("quote"):
            lines.append(f'{name} said: "{alert["quote"]}"')
        if alert["severity"] == "urgent" and alert["category"] != "scam":
            lines.append(f"Please call {name} now. If you cannot reach them, contact local emergency services ({elder.get('emergencyNumber') or '112'}).")
        lines.append(f"View and acknowledge: {settings.family_app_url}/dashboard/alerts")
        await self.send_family(elder, subject, "\n".join(l for l in lines if l), urgent=alert["severity"] == "urgent")
        db.update("alerts", alert["id"], {"notifiedAt": db.now_utc()})

    async def family_message(self, elder: dict, subject: str, body: str) -> None:
        await self.send_family(elder, subject, body)

    async def conversation_summary(self, elder: dict, result: dict, daily: dict, channel: str) -> None:
        name = elder.get("preferredName") or elder["name"]
        via = "phone call" if channel == "phone" else "chat"
        body = [result["summary"], f"Mood: {result.get('moodLabel') or '-'}"]
        meds = f"Medicines today: {daily.get('medsTaken', 0)} taken"
        if daily.get("medsMissed"):
            meds += f", {daily['medsMissed']} missed"
        body.append(meds)
        talk = json.loads(daily["talkAbout"]) if isinstance(daily.get("talkAbout"), str) else daily.get("talkAbout") or []
        if talk:
            body.append(f"Talk about this: {talk[0]}")
        await self.send_family(elder, f"{name}'s {via} with Kinly", "\n".join(body))


notifier = Notifier()
