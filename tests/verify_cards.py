import time
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # --- Context 1: Mobile ---
        context_mobile = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
        )
        # FORCE Three.js to run in headless mode
        context_mobile.add_init_script("window.__FORCE_THREE_EARTH = true")

        page_mobile = context_mobile.new_page()
        print("Loading page on Mobile...")
        page_mobile.goto("http://localhost:8080/")

        # Wait for loading screen to go away
        try:
            page_mobile.wait_for_selector("#loadingScreen", state="hidden", timeout=15000)
        except:
            print("Loading screen timeout")

        print("Scrolling to Features (Mobile)...")
        # Scroll to trigger lazy load
        page_mobile.evaluate("document.getElementById('features').scrollIntoView({behavior: 'instant', block: 'start'})")

        # Wait for the card content to be loaded into DOM
        try:
            page_mobile.wait_for_selector(".features-cards .card", timeout=10000)
            print("Card DOM elements found.")
        except:
            print("Card DOM elements NOT found!")

        # Wait for 3D transition
        time.sleep(3)

        page_mobile.screenshot(path="verify_mobile_layout.png")
        print("Saved verify_mobile_layout.png")

        # --- Context 2: Desktop ---
        context_desktop = browser.new_context(
            viewport={'width': 1280, 'height': 800}
        )
        context_desktop.add_init_script("window.__FORCE_THREE_EARTH = true")

        page_desktop = context_desktop.new_page()
        print("Loading page on Desktop...")
        page_desktop.goto("http://localhost:8080/")

        try:
            page_desktop.wait_for_selector("#loadingScreen", state="hidden", timeout=15000)
        except:
            pass

        print("Scrolling to Features (Desktop)...")
        page_desktop.evaluate("document.getElementById('features').scrollIntoView({behavior: 'instant', block: 'center'})")

        try:
            page_desktop.wait_for_selector(".features-cards .card", timeout=10000)
        except:
            pass

        time.sleep(3)
        page_desktop.screenshot(path="verify_desktop_features_initial.png")

        print("Scrolling to About...")
        page_desktop.evaluate("document.getElementById('about').scrollIntoView({behavior: 'instant', block: 'center'})")
        time.sleep(2)

        print("Scrolling BACK to Features...")
        page_desktop.evaluate("document.getElementById('features').scrollIntoView({behavior: 'instant', block: 'center'})")
        time.sleep(2)

        page_desktop.screenshot(path="verify_desktop_features_return.png")
        print("Saved verify_desktop_features_return.png")

        browser.close()

if __name__ == "__main__":
    run()
