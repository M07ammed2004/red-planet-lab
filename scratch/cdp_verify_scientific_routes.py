import asyncio
import base64
import json
import subprocess
import time
import httpx
import websockets

EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ARTIFACT_DIR = r"C:\Users\hp\.gemini\antigravity\brain\251dae3e-e02f-4bcf-b381-ce18a6e7964b"

async def cdp_call(ws, method, params=None, msg_id=1):
    req = {"id": msg_id, "method": method, "params": params or {}}
    await ws.send(json.dumps(req))
    while True:
        resp = json.loads(await ws.recv())
        if resp.get("id") == msg_id:
            return resp.get("result", {})

async def capture_screenshot(ws, filename, msg_id=100):
    res = await cdp_call(ws, "Page.captureScreenshot", {"format": "png"}, msg_id=msg_id)
    data = base64.b64decode(res["data"])
    out_path = f"{ARTIFACT_DIR}\\{filename}"
    with open(out_path, "wb") as f:
        f.write(data)
    print(f"Captured: {out_path} ({len(data)} bytes)", flush=True)

async def evaluate(ws, expr, msg_id=200):
    res = await cdp_call(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True}, msg_id=msg_id)
    return res.get("result", {}).get("value")

async def main():
    print("Launching Edge headless...", flush=True)
    proc = subprocess.Popen([
        EDGE_PATH,
        "--headless=new",
        "--remote-debugging-port=9222",
        "--user-data-dir=d:\\red-planet-lab\\.edge_profile",
        "--disable-extensions",
        "--window-size=1440,900",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank"
    ])

    time.sleep(2)
    try:
        tabs = None
        for attempt in range(10):
            try:
                async with httpx.AsyncClient() as client:
                    resp = await client.get("http://127.0.0.1:9222/json", timeout=2.0)
                    if resp.status_code == 200:
                        tabs = resp.json()
                        break
            except Exception:
                await asyncio.sleep(1)
        if not tabs:
            raise RuntimeError("Could not connect to Edge DevTools port 9222")
        page_tab = next(t for t in tabs if t.get("type") == "page")
        ws_url = page_tab["webSocketDebuggerUrl"]

        print(f"Connecting to page WS: {ws_url}", flush=True)
        async with websockets.connect(ws_url, max_size=20*1024*1024) as ws:
            print("Connected to CDP!", flush=True)
            await cdp_call(ws, "Page.enable")
            await cdp_call(ws, "Runtime.enable")

            print("Navigating to http://127.0.0.1:5173/ ...", flush=True)
            await cdp_call(ws, "Page.navigate", {"url": "http://127.0.0.1:5173/"})
            await asyncio.sleep(4)

            # Switch to Mission Control
            print("Clicking MISSION CONTROL nav tab...", flush=True)
            await evaluate(ws, """
                (() => {
                    const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
                    const mcBtn = navBtns.find(b => b.textContent.includes('MISSION CONTROL'));
                    if (mcBtn) mcBtn.click();
                })()
            """, msg_id=301)
            await asyncio.sleep(3)

            # Click Calculate Mission Routes
            print("Clicking CALCULATE MISSION ROUTES...", flush=True)
            await evaluate(ws, """
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const calcBtn = btns.find(b => b.textContent.includes('CALCULATE MISSION ROUTES'));
                    if (calcBtn) calcBtn.click();
                })()
            """, msg_id=302)
            await asyncio.sleep(4)

            # 1. Capture 3D terrain with 3 routes
            print("Capturing 3D terrain with 3 routes...", flush=True)
            await capture_screenshot(ws, "27_mission_scientific_route_3d.png", msg_id=303)

            # 2. Scroll to evaluation cards & elevation chart
            print("Scrolling to evaluation cards...", flush=True)
            await evaluate(ws, """
                (() => {
                    const panel = document.querySelector('.routes-comparison-grid');
                    if (panel) panel.scrollIntoView({ behavior: 'instant', block: 'start' });
                })()
            """, msg_id=304)
            await asyncio.sleep(1)
            await capture_screenshot(ws, "28_mission_scientific_cards_and_chart.png", msg_id=305)

            # 3. Scroll to waypoints table
            print("Scrolling to waypoints table...", flush=True)
            await evaluate(ws, """
                (() => {
                    const table = document.querySelector('.waypoints-card');
                    if (table) table.scrollIntoView({ behavior: 'instant', block: 'start' });
                })()
            """, msg_id=306)
            await asyncio.sleep(1)
            await capture_screenshot(ws, "29_mission_scientific_waypoints_table.png", msg_id=307)

            print("All screenshots successfully captured!", flush=True)
    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(main())
