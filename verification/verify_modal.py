
from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen to console
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

        print("Navigating to projects page...")
        page.goto("http://localhost:8080/pages/projekte/index.html")

        print("Waiting for canvas...")
        page.wait_for_selector("canvas", timeout=10000)

        time.sleep(5) # Wait longer for 3D init

        viewport = page.viewport_size
        width = viewport['width']
        height = viewport['height']

        # Try clicking center-ish area where index 0 might be
        # Index 0: x=0, y=3.5, z=0.
        # Camera: x=0, y=1, z=5.
        # Project is UP relative to camera.

        points_to_try = [
            (width / 2, height * 0.3),   # Upper center
            (width / 2, height * 0.4),   # Slightly lower
            (width / 2, height * 0.25),  # Higher
            (width / 2 - 50, height * 0.3), # Left
            (width / 2 + 50, height * 0.3), # Right
        ]

        for i, (x, y) in enumerate(points_to_try):
            print(f"Attempt {i+1}: Clicking at ({x}, {y})")
            page.mouse.click(x, y)
            time.sleep(1)

            # Check for modal
            if page.is_visible(".app-preview"):
                print("Modal appeared!")
                page.screenshot(path="verification_modal_success.png")
                return

        print("Modal did not appear after all attempts.")
        page.screenshot(path="verification_modal_failed.png")

        browser.close()

if __name__ == "__main__":
    run()
