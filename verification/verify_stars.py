
from playwright.sync_api import sync_playwright

def verify_star_alignment():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Navigate to page (debug mode to enable ThreeJS)
        page.goto("http://localhost:8081/?debug=true")

        # Scroll to features
        page.evaluate("document.getElementById('features').scrollIntoView()")

        # Wait for animation to complete
        page.wait_for_timeout(5000)

        # Take screenshot
        screenshot_path = "verification/star_alignment.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        browser.close()

if __name__ == "__main__":
    verify_star_alignment()
