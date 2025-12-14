
import time
from playwright.sync_api import sync_playwright

def verify_cards():
    with sync_playwright() as p:
        # Launch browser (ensure WebGL support is not disabled if possible, though headless might vary)
        # Note: Headless Chrome sometimes has issues with WebGL. We try to force it.
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=egl",
                "--ignore-gpu-blocklist",
                "--enable-webgl",
                "--enable-webgl2"
            ]
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 800},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        # Navigate to the page
        # Note: The server is running on 8081 based on memory, or 8080 default.
        # package.json 'serve' usually defaults to 8080 unless configured.
        # Let's try 8080 first, if fails we might need to check the log.
        # Checking memory: "Playwright's configuration launches a web server on port 8081"
        # Checking previous logs: "iweb@0.2.2 dev ... http-server ... -p 8081" (implied from typical setup)
        # I'll check the server log first if needed, but 8081 is safe bet from memory.
        try:
            page.goto("http://localhost:8081", timeout=10000)
        except:
             page.goto("http://localhost:8080")

        # Wait for the loading screen to disappear
        page.wait_for_selector("#loadingScreen", state="hidden", timeout=10000)

        # Force ThreeEarthSystem to init if it's conditional (memory says it might be disabled in headless)
        # We can try to force it via window.__FORCE_THREE_EARTH = true BEFORE load, but we already loaded.
        # Let's reload with the flag injected or just rely on the args.
        # Actually, memory says: "The content/main.js module disables the Three.js Earth system in test environments... allow override via window.__FORCE_THREE_EARTH = true"

        # Reload with script injection
        page.add_init_script("window.__FORCE_THREE_EARTH = true;")
        page.reload()
        page.wait_for_selector("#loadingScreen", state="hidden", timeout=10000)

        # Scroll to features section
        # The cards are in #features.
        features_section = page.locator("#features")
        features_section.scroll_into_view_if_needed()

        # Wait a bit for the intersection observer to trigger and the animation to start
        time.sleep(2)

        # The cards are rendered on a canvas in #threeEarthContainer usually, but wait,
        # CardManager adds `this.cardGroup` to the scene. The scene is rendered on the main canvas.
        # The original DOM elements in `.features-cards` might be hidden or just used as data sources.
        # Let's check if the cards are visible on the canvas.

        # Take a screenshot of the features section area
        page.screenshot(path="verification/verification.png", full_page=False)
        print("Screenshot taken at verification/verification.png")

        browser.close()

if __name__ == "__main__":
    verify_cards()
