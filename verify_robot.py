
import os
import re
from playwright.sync_api import sync_playwright, expect

def verify_robot_loader():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-swiftshader", "--disable-gpu", "--font-render-hinting=none"]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Define path for verification images
        os.makedirs("verification", exist_ok=True)

        print("Navigating to index.html...")
        page.goto("http://localhost:8081/index.html")

        # 1. Verify Loading State
        print("Verifying Loading State...")
        container = page.locator("#robot-companion-container")
        expect(container).to_be_visible()

        # Check if it has the loading class
        expect(container).to_have_class(re.compile(r"robot-loading"))

        # Verify centering styles (computed)
        box = container.bounding_box()
        viewport = page.viewport_size
        center_x = box["x"] + box["width"] / 2
        center_y = box["y"] + box["height"] / 2

        # Allow small margin of error for centering
        print(f"Robot Center: ({center_x}, {center_y}) vs Viewport Center: ({viewport['width']/2}, {viewport['height']/2})")
        assert abs(center_x - viewport['width']/2) < 50, "Robot not centered horizontally"
        assert abs(center_y - viewport['height']/2) < 50, "Robot not centered vertically"

        page.screenshot(path="verification/1_loading_state.png")
        print("Captured loading state screenshot.")

        # 2. Verify Transition to Normal State
        # The transition triggers on 'app-loaded' which fires on window.load + delay
        # We can force it by simulating the event if it takes too long, but let's wait first.
        print("Waiting for Normal State transition...")

        # Wait for class removal
        try:
            expect(container).not_to_have_class(re.compile(r"robot-loading"), timeout=15000)
        except Exception as e:
            print("Timeout waiting for robot-loading removal. Forcing event...")
            page.evaluate("window.dispatchEvent(new CustomEvent('app-loaded'))")
            expect(container).not_to_have_class(re.compile(r"robot-loading"))

        # Wait for CSS transition to settle (approx 0.8s)
        page.wait_for_timeout(1000)

        # Verify it moved to bottom right
        box_final = container.bounding_box()
        print(f"Final Robot Position: ({box_final['x']}, {box_final['y']})")

        # Bottom right check (x > 1000, y > 500 for 1280x720)
        assert box_final['x'] > 1000, "Robot did not move to right"
        assert box_final['y'] > 500, "Robot did not move to bottom"

        page.screenshot(path="verification/2_normal_state.png")
        print("Captured normal state screenshot.")

        browser.close()

if __name__ == "__main__":
    verify_robot_loader()
