"""Registry of connected elder screens so the backend can push events to them
(incoming video call, new voice message, medicine reminder, demo commands)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Awaitable, Callable

from loguru import logger


@dataclass
class ScreenConnection:
    client_uid: str
    elder_id: str
    send_text: Callable[[str], Awaitable[None]]


class ScreenHub:
    def __init__(self) -> None:
        self._by_client: dict[str, ScreenConnection] = {}

    def register(self, client_uid: str, elder_id: str, send_text: Callable[[str], Awaitable[None]]) -> None:
        self._by_client[client_uid] = ScreenConnection(client_uid, elder_id, send_text)
        logger.info(f"Elder screen connected: elder={elder_id} client={client_uid}")

    def unregister(self, client_uid: str) -> None:
        self._by_client.pop(client_uid, None)

    def elder_for(self, client_uid: str) -> str | None:
        conn = self._by_client.get(client_uid)
        return conn.elder_id if conn else None

    def is_online(self, elder_id: str) -> bool:
        return any(c.elder_id == elder_id for c in self._by_client.values())

    def online_elders(self) -> set[str]:
        return {c.elder_id for c in self._by_client.values()}

    async def push(self, elder_id: str, message: dict) -> int:
        delivered = 0
        for conn in list(self._by_client.values()):
            if conn.elder_id != elder_id:
                continue
            try:
                await conn.send_text(json.dumps(message))
                delivered += 1
            except Exception as e:
                logger.warning(f"Push to screen {conn.client_uid} failed: {e}")
                self.unregister(conn.client_uid)
        return delivered


hub = ScreenHub()
