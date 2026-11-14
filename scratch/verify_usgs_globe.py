import os
import time
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = r"C:\Users\hp\.gemini\antigravity\brain\251dae3e-e02f-4bcf-b381-ce18a6e7964b"

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("Navigating to http://127.0.0.1:5173/ ...")
        page.goto("http://127.0.0.1:5173/")
        time.sleep(3)

        # 1. Global Overview Screenshot
        shot1 = os.path.join(ARTIFACT_DIR, "21_usgs_globe_overview.png")
        page.screenshot(path=shot1)
        print(f"Captured {shot1}")

        # 2. Filter by Montes / Volcanoes and select Olympus Mons
        print("Filtering by Montes / Volcanoes...")
        montes_btn = page.locator("button.nom-tab:has-text('MONTES')")
        if montes_btn.count() > 0:
            montes_btn.first.click()
            time.sleep(1)

        olympus_chip = page.locator("button.region-chip:has-text('Olympus Mons')")
        if olympus_chip.count() > 0:
            olympus_chip.first.click()
            time.sleep(2)

        shot2 = os.path.join(ARTIFACT_DIR, "22_usgs_landmark_drawer.png")
        page.screenshot(path=shot2)
        print(f"Captured {shot2}")

        # 3. Filter by Exploration Sectors and select Jezero Crater
        print("Filtering by Exploration Sectors...")
        sectors_btn = page.locator("button.nom-tab:has-text('EXPLORATION SECTORS')")
        if sectors_btn.count() > 0:
            sectors_btn.first.click()
            time.sleep(1)

        jezero_chip = page.locator("button.region-chip:has-text('Jezero Crater')")
        if jezero_chip.count() > 0:
            jezero_chip.first.click()
            time.sleep(2)

        shot3 = os.path.join(ARTIFACT_DIR, "23_usgs_scouted_patches.png")
        page.screenshot(path=shot3)
        print(f"Captured {shot3}")

        browser.close()
        print("Verification script completed successfully!")

if __name__ == "__main__":
    run_verification()
