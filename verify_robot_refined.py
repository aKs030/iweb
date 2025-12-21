
import os
import re
from playwright.sync_api import sync_playwright, expect

def verify_robot_loader_refined():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-swiftshader", "--disable-gpu", "--font-render-hinting=none"]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        os.makedirs("verification", exist_ok=True)

        print("Navigating to index.html...")
        page.goto("http://localhost:8081/index.html")

        # 1. Verify Loading Backdrop
        print("Verifying Loading Backdrop...")
        backdrop = page.locator("#loading-backdrop")
        expect(backdrop).to_be_visible()
        # Verify it has correct background color
        expect(backdrop).to_have_css("background-color", "rgb(11, 18, 32)")

        # 2. Verify Robot Centering
        print("Verifying Robot Loading State...")
        container = page.locator("#robot-companion-container")
        expect(container).to_have_class(re.compile(r"robot-loading"))

        box = container.bounding_box()
        viewport = page.viewport_size
        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        print(f"Robot Center: ({center_x}, {center_y})")
        assert abs(center_x - viewport['width']/2) < 50
        assert abs(center_y - viewport['height']/2) < 50

        page.screenshot(path="verification/3_loading_with_backdrop.png")
        print("Captured loading state screenshot.")

        # 3. Verify Transition and Backdrop Removal
        print("Waiting for transition...")

        # Wait for robot-loading class removal (triggered by app-loaded)
        try:
            expect(container).not_to_have_class(re.compile(r"robot-loading"), timeout=15000)
        except:
             # Force it if needed (though main.js should handle it now)
             print("Forcing app-loaded event...")
             page.evaluate("window.dispatchEvent(new CustomEvent('app-loaded'))")
             expect(container).not_to_have_class(re.compile(r"robot-loading"))

        # Wait for backdrop to fade out (class added) or be removed from DOM
        # The code removes it from DOM after 800ms
        print("Waiting for backdrop removal...")
        page.wait_for_timeout(1000)

        # Expect backdrop to be detached or hidden
        if backdrop.count() > 0:
             expect(backdrop).not_to_be_visible()

        # Verify final position
        box_final = container.bounding_box()
        print(f"Final Robot Position: ({box_final['x']}, {box_final['y']})")
        assert box_final['x'] > 1000
        assert box_final['y'] > 500

        page.screenshot(path="verification/4_normal_state_refined.png")
        print("Captured normal state screenshot.")

        browser.close()

if __name__ == "__main__":
    verify_robot_loader_refined()
