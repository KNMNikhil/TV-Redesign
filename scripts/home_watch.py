#!/usr/bin/env python3
"""Optional: make the Home button open this launcher instead of LG's home screen.

webOS does not let an app replace Home, so this runs on another always-on device on the same network.
It watches which app is in the foreground and, the moment LG's home appears, launches the launcher on top
(LG's home is visible for about half a second). Press Home twice within three seconds to stay on LG's home.

    python scripts/home_watch.py <TV_IP>      # Ctrl-C stops it and Home goes back to normal

Pair once first (scripts/sync_apps.py does it).
"""
import asyncio
import json
import os
import sys
import time

import tvlink

ESCAPE_SECONDS = 3.0


def log(*parts):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), *parts, flush=True)


async def watch(host):
    ws = await tvlink.connect(host, ping_interval=10, ping_timeout=10)
    log("connected")
    last_redirect = 0.0
    try:
        await ws.send(json.dumps({"type": "subscribe", "id": "fg", "payload": {},
                                  "uri": "ssap://com.webos.applicationManager/getForegroundAppInfo"}))
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("id") != "fg" or msg.get("payload", {}).get("appId") != tvlink.LG_HOME_ID:
                continue
            now = time.monotonic()
            if now - last_redirect < ESCAPE_SECONDS:
                log("Home pressed twice: staying on LG home")
                last_redirect = 0.0
                continue
            last_redirect = now
            await ws.send(json.dumps({"type": "request", "id": "launch", "uri": "ssap://system.launcher/launch",
                                      "payload": {"id": tvlink.APP_ID}}))
            log("LG home -> launcher")
    finally:
        await ws.close()


async def main(host):
    delay = 5
    while True:
        try:
            await watch(host)
            delay = 5
        except (OSError, asyncio.TimeoutError, tvlink.websockets.WebSocketException) as err:
            # TV off, in standby or off the network: keep trying, backing off to 20 seconds.
            log("not connected:", type(err).__name__)
            delay = min(delay * 2, 20)
        await asyncio.sleep(delay)


if __name__ == "__main__":
    host = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TV_HOST")
    if not host:
        sys.exit("usage: home_watch.py <TV_IP>")
    try:
        asyncio.run(main(host))
    except KeyboardInterrupt:
        pass
