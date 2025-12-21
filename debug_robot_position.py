
import os
import re
from playwright.sync_api import sync_playwright, expect

def debug_robot_position():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--enable-unsafe-swiftshader", "--disable-gpu", "--font-render-hinting=none"]
        )
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        print("Navigating to index.html...")
        page.goto("http://localhost:8081/index.html")

        # Wait for transition
        container = page.locator("#robot-companion-container")
        print("Waiting for transition...")
        page.wait_for_timeout(2000) # Wait ample time for loading + transition

        # Check if robot-loading is gone
        classes = container.get_attribute("class")
        print(f"Classes: {classes}")

        # Computed Styles
        computed = container.evaluate("el => { const s = window.getComputedStyle(el); return { left: s.left, right: s.right, top: s.top, bottom: s.bottom, transform: s.transform, width: s.width, position: s.position }; }")
        print(f"Computed Styles: {computed}")

        box = container.bounding_box()
        print(f"Bounding Box: {box}")

        browser.close()

if __name__ == "__main__":
    debug_robot_position()
