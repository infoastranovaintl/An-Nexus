"""AN-Nexus mock base station — streams all sensor data from multiple nodes.

Run:  python scripts/mock_base.py
The dashboard auto-connects to ws://localhost:8080 and broadcasts a full
sensor profile every 3 s from 5 field nodes, plus periodic HELLO/PAIRED keepalives.
"""

import asyncio
import random
import time

import websockets

NODES = [
    {"mac": "90649B083801", "id": 1, "rssi": -45, "ssid": "n1", "name": "Dam-South",
     "sensors": {"temp": 28.4, "atmp": 1013.2, "altitude": 1342, "turbidity": 85, "water": 142, "hum": 62, "battery": 3.82, "waterTemp": 24.1}},
    {"mac": "A4CF12D45E02", "id": 2, "rssi": -52, "ssid": "n2", "name": "River-Inlet",
     "sensors": {"temp": 26.8, "atmp": 1012.8, "altitude": 980, "turbidity": 120, "water": 210, "hum": 71, "battery": 3.95, "waterTemp": 22.3, "flow": 18.5, "ph": 7.2}},
    {"mac": "B827EB67CF03", "id": 3, "rssi": -61, "ssid": "n3", "name": "Plant-Intake",
     "sensors": {"temp": 31.2, "atmp": 1011.5, "altitude": 850, "turbidity": 42, "water": 320, "hum": 55, "battery": 4.01, "waterTemp": 25.8, "flow": 32.1, "pressure": 45.2, "wind": 12.4}},
    {"mac": "CC50E3ABC104", "id": 4, "rssi": -38, "ssid": "n4", "name": "Tank-Top",
     "sensors": {"temp": 24.5, "atmp": 1013.5, "altitude": 1100, "turbidity": 25, "water": 85, "hum": 48, "battery": 3.72, "waterTemp": 21.0, "distance": 145, "rain": 2.3}},
    {"mac": "DC4F2212AA05", "id": 5, "rssi": -70, "ssid": "n5", "name": "Reservoir-East",
     "sensors": {"temp": 22.1, "atmp": 1014.0, "altitude": 1500, "turbidity": 65, "water": 520, "hum": 78, "battery": 3.65, "waterTemp": 19.8, "flow": 8.7, "wind": 28.6, "rain": 0.0}},
]

STATE = {n["mac"]: dict(n["sensors"]) for n in NODES}


def jitter(base: float, amp: float) -> float:
    return base + random.uniform(-amp, amp)


def drift(val: float, low: float, high: float, step: float = 0.3) -> float:
    val += random.uniform(-step, step)
    return max(low, min(high, val))


def build_sensor_payload(mac: str) -> str:
    s = STATE[mac]
    s["temp"] = drift(s["temp"], 15, 40, 0.4)
    s["atmp"] = drift(s["atmp"], 990, 1035, 0.3)
    s["altitude"] = drift(s["altitude"], 0, 5000, 0.2)
    s["turbidity"] = drift(s["turbidity"], 0, 400, 1.5)
    s["water"] = drift(s["water"], 0, 600, 1.0)
    s["hum"] = drift(s["hum"], 0, 100, 0.8)
    s["battery"] = drift(s["battery"], 3.0, 4.2, 0.01)
    s["waterTemp"] = drift(s["waterTemp"], 5, 40, 0.2)
    if "flow" in s:
        s["flow"] = drift(s["flow"], 0, 120, 0.5)
    if "ph" in s:
        s["ph"] = drift(s["ph"], 5, 9, 0.05)
    if "pressure" in s:
        s["pressure"] = drift(s["pressure"], 0, 150, 0.4)
    if "wind" in s:
        s["wind"] = drift(s["wind"], 0, 120, 0.6)
    if "rain" in s:
        s["rain"] = max(0, drift(s["rain"], 0, 120, 0.1))
    if "distance" in s:
        s["distance"] = drift(s["distance"], 0, 400, 1.2)

    parts = [f"temp={s['temp']:.1f}", f"atmp={s['atmp']:.1f}",
             f"altitude={s['altitude']:.0f}", f"turbidity={s['turbidity']:.1f}",
             f"water={int(s['water'])}cm", f"hum={s['hum']:.1f}",
             f"battery={s['battery']:.2f}", f"waterTemp={s['waterTemp']:.1f}"]
    if "flow" in s:
        parts.append(f"flow={s['flow']:.1f}")
    if "ph" in s:
        parts.append(f"ph={s['ph']:.2f}")
    if "pressure" in s:
        parts.append(f"pressure={s['pressure']:.1f}")
    if "wind" in s:
        parts.append(f"wind={s['wind']:.1f}")
    if "rain" in s:
        parts.append(f"rain={s['rain']:.1f}")
    if "distance" in s:
        parts.append(f"distance={s['distance']:.1f}")
    return ":".join(parts)


async def broadcast(ws: websockets.WebSocketServerProtocol) -> None:
    for n in NODES:
        mac = n["mac"]
        await ws.send(f"HELLO:{mac}:id={n['id']}:rssi={n['rssi'] + random.randint(-3, 3)}:ssid={n['ssid']}")
        await ws.send(f"PAIRED:{mac}:id={n['id']}")
        await ws.send(f"DATA:{mac}:id={n['id']}:payload={build_sensor_payload(mac)}")


async def handler(ws: websockets.WebSocketServerProtocol) -> None:
    try:
        while True:
            await broadcast(ws)
            try:
                await asyncio.wait_for(ws.recv(), timeout=3.0)
            except asyncio.TimeoutError:
                continue
    except Exception:
        pass


async def main() -> None:
    async with websockets.serve(handler, "localhost", 8080):
        print("mock base station on ws://localhost:8080 — 5 nodes, all sensors", flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
