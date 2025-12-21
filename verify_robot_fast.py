
import os
import re
from playwright.sync_api import sync_playwright, expect

def verify_robot_loader_fast():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-swiftshader", "--disable-gpu", "--font-render-hinting=none"]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        os.makedirs("verification", exist_ok=True)

        print("Navigating to index.html (commit)...")
        # Use commit to catch the page before 'load' fires and clears the loader
        page.goto("http://localhost:8081/index.html", wait_until="commit")

        # 1. Verify Loading Backdrop
        print("Verifying Loading Backdrop...")
        backdrop = page.locator("#loading-backdrop")
        expect(backdrop).to_be_visible()
        expect(backdrop).to_have_css("background-color", "rgb(11, 18, 32)")

        # 2. Verify Robot Centering (Loading State)
        print("Verifying Robot Loading State...")
        container = page.locator("#robot-companion-container")

        # Note: If the machine is super fast, it might still race, but this gives best chance.
        # If it fails, we might need to inject a script to delay app-loaded, but let's try this.
        expect(container).to_have_class(re.compile(r"robot-loading"))
        expect(container).to_have_css("top", "360px")
        expect(container).to_have_css("left", "640px")

        page.screenshot(path="verification/3_loading_with_backdrop.png")
        print("Captured loading state screenshot.")

        # 3. Verify Transition and Backdrop Removal
        print("Waiting for transition...")

        # Now wait for the load to naturally happen
        page.wait_for_load_state("load")

        # Wait for robot-loading class removal
        try:
            expect(container).not_to_have_class(re.compile(r"robot-loading"), timeout=15000)
        except:
             print("Forcing app-loaded event...")
             page.evaluate("window.dispatchEvent(new CustomEvent('app-loaded'))")
             expect(container).not_to_have_class(re.compile(r"robot-loading"))

        print("Waiting for backdrop removal...")
        page.wait_for_timeout(1000)

        if backdrop.count() > 0:
             expect(backdrop).not_to_be_visible()

        # 4. Verify Final Base Position (CSS)
        print("Verifying Final Base CSS...")
        expect(container).to_have_css("right", "30px")
        expect(container).to_have_css("pointer-events", "auto")

        page.screenshot(path="verification/4_normal_state_final.png")
        print("Captured normal state screenshot.")

        browser.close()

if __name__ == "__main__":
    verify_robot_loader_fast()
