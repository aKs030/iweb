from playwright.sync_api import sync_playwright, expect
import time

def verify_cards():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Disable webdriver flag
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )

        # Mask webdriver property
        context.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => false})")

        page = context.new_page()

        page.goto("http://localhost:8080")

        page.wait_for_load_state("domcontentloaded")
        page.wait_for_selector("#loadingScreen.hide", state="hidden", timeout=10000)

        # Force scroll to features
        page.evaluate("document.getElementById('features').scrollIntoView()")

        print("Waiting for animations...")
        time.sleep(8) # Increased wait time

        screenshot_path = "verification/cards_verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        body_class = page.evaluate("document.body.className")
        print(f"Body classes: {body_class}")

        # Check if canvas exists
        canvas_count = page.locator("#threeEarthContainer canvas").count()
        print(f"Canvas count: {canvas_count}")

        browser.close()

if __name__ == "__main__":
    verify_cards()
