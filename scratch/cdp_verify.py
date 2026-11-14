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
        # Get websocket debugger URL for the page
        async with httpx.AsyncClient() as client:
            tabs = (await client.get("http://127.0.0.1:9222/json")).json()
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

            # 1. Overview Screenshot (Deluxe Observatory Theme with realistic Mars Globe in center)
            await capture_screenshot(ws, "24_deluxe_theme_overview.png", msg_id=401)

            # 2. Click on "MONTES / VOLCANOES" filter tab
            print("Clicking MONTES tab...", flush=True)
            await evaluate(ws, """
                (() => {
                    const tabs = Array.from(document.querySelectorAll('.nom-tab'));
                    const montesTab = tabs.find(t => t.textContent.includes('MONTES'));
                    if (montesTab) montesTab.click();
                })()
            """, msg_id=402)
            await asyncio.sleep(1.5)

            # Click on "Olympus Mons" chip
            print("Clicking Olympus Mons chip...", flush=True)
            await evaluate(ws, """
                (() => {
                    const chips = Array.from(document.querySelectorAll('.region-chip'));
                    const olympus = chips.find(c => c.textContent.includes('Olympus Mons'));
                    if (olympus) olympus.click();
                })()
            """, msg_id=403)
            await asyncio.sleep(2.5)

            # Capture Olympus Mons
            await capture_screenshot(ws, "25_deluxe_olympus_mons.png", msg_id=404)

            # 3. Click on "EXPLORATION SECTORS" tab and select Jezero Crater
            print("Clicking EXPLORATION SECTORS tab...", flush=True)
            await evaluate(ws, """
                (() => {
                    const tabs = Array.from(document.querySelectorAll('.nom-tab'));
                    const secTab = tabs.find(t => t.textContent.includes('EXPLORATION SECTORS'));
                    if (secTab) secTab.click();
                })()
            """, msg_id=405)
            await asyncio.sleep(1.5)

            print("Clicking Jezero Crater chip...", flush=True)
            await evaluate(ws, """
                (() => {
                    const chips = Array.from(document.querySelectorAll('.region-chip'));
                    const jezero = chips.find(c => c.textContent.includes('Jezero Crater'));
                    if (jezero) jezero.click();
                })()
            """, msg_id=406)
            await asyncio.sleep(2.5)

            # Capture Jezero Crater Sector Drawer & scouted patch
            await capture_screenshot(ws, "26_deluxe_jezero_scouted.png", msg_id=407)

            print("All screenshots captured successfully!", flush=True)

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except Exception:
            proc.kill()

if __name__ == "__main__":
    asyncio.run(main())
