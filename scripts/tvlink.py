"""Connection to an LG webOS TV on the local network.

webOS TVs expose a remote-control service (the one LG's phone app uses) on wss://<tv>:3001. The first
connection shows a pairing prompt on the TV; after it is accepted the TV hands back a client key, which is
stored next to the project in .tv-key.json (readable by you only) and reused from then on.

Only the permissions this project needs are requested: launching apps, seeing the foreground app, listing
installed apps and listing inputs. Nothing that can change settings, power or input.
"""
import asyncio
import ipaddress
import json
import os
import ssl
import sys

import websockets

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KEY_FILE = os.environ.get("TV_KEY_FILE", os.path.join(ROOT, ".tv-key.json"))
APP_ID = "com.knmnikhil.tvredesign"
LG_HOME_ID = "com.webos.app.home"

PERMISSIONS = [
    "LAUNCH",
    "READ_APP_STATUS",
    "READ_RUNNING_APPS",
    "READ_INSTALLED_APPS",
    "READ_INPUT_DEVICE_LIST",
]


def require_local(host):
    """Only ever talk to a device on the home network, never to a public address or a hostname."""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        sys.exit(f"Use the TV's IP address, not a hostname: {host}")
    if not (ip.is_private or ip.is_link_local):
        sys.exit(f"Refusing non-local address: {host}")


def tls_context():
    """The TV presents a certificate from LG's own CA, so it cannot be verified against public roots."""
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def _load_keys():
    try:
        with open(KEY_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save_key(host, key):
    keys = _load_keys()
    keys[host] = key
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(keys, f, indent=1)
    os.chmod(KEY_FILE, 0o600)


async def connect(host, **options):
    """Open a paired session with the TV. Accept the prompt on the TV the first time."""
    require_local(host)
    key = _load_keys().get(host)
    ws = await websockets.connect(f"wss://{host}:3001", ssl=tls_context(), open_timeout=10, max_size=None, **options)
    payload = {
        "forcePairing": False,
        "pairingType": "PROMPT",
        "manifest": {"manifestVersion": 1, "appVersion": "1.0", "permissions": PERMISSIONS},
    }
    if key:
        payload["client-key"] = key
    else:
        print("Accept the pairing prompt on the TV...")
    await ws.send(json.dumps({"type": "register", "id": "register_0", "payload": payload}))
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), 60))
        if msg["type"] == "registered":
            break
        if msg["type"] == "error":
            await ws.close()
            sys.exit(f"Pairing failed: {msg.get('error')}")
    if msg["payload"]["client-key"] != key:
        _save_key(host, msg["payload"]["client-key"])
    return ws


_counter = [0]


async def request(ws, uri, payload=None):
    """Send one request and return its reply payload."""
    _counter[0] += 1
    rid = f"req{_counter[0]}"
    await ws.send(json.dumps({"type": "request", "id": rid, "uri": uri, "payload": payload or {}}))
    while True:
        msg = json.loads(await asyncio.wait_for(ws.recv(), 20))
        if msg.get("id") == rid:
            return msg.get("payload", {})
