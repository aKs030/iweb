import time
import os
from playwright.sync_api import sync_playwright

def verify_mobile_cards():
    with sync_playwright() as p:
        viewport_width = 375
        viewport_height = 812

        browser = p.chromium.launch(headless=True, args=['--enable-unsafe-swiftshader'])
        context = browser.new_context(
            viewport={'width': viewport_width, 'height': viewport_height},
            device_scale_factor=2
        )
        page = context.new_page()

        page.add_init_script("window.__FORCE_THREE_EARTH = true;")
        page.goto("http://localhost:8081/index.html?debug=true")

        try:
            page.wait_for_selector("#loadingScreen.hide", state="hidden", timeout=10000)
        except:
            pass

        page.locator("#features").scroll_into_view_if_needed()

        try:
            page.wait_for_function("() => window.threeEarthSystem && window.threeEarthSystem.cardManager", timeout=10000)
        except:
            browser.close()
            return False

        time.sleep(2)

        # Write to tests directory which is visible
        cwd = os.getcwd()
        screenshot_path = os.path.join(cwd, "tests", "mobile_cards_verification.png")

        try:
            page.screenshot(path=screenshot_path)
            print(f"Screenshot saved to {screenshot_path}")
            if os.path.exists(screenshot_path):
                print(f"File confirmed to exist: {screenshot_path}")
            else:
                print(f"File NOT found immediately after save: {screenshot_path}")
        except Exception as e:
            print(f"Screenshot failed: {e}")

        result = page.evaluate("""() => {
            const cm = window.threeEarthSystem.cardManager;
            if (!cm || cm.cards.length === 0) return { error: "No cards" };
            const width = window.innerWidth;
            const camera = cm.camera;
            const cardData = cm.cards.map(card => {
                const pos = card.position.clone();
                pos.project(camera);
                const x = (pos.x * 0.5 + 0.5) * width;
                const edgePos = card.position.clone();
                edgePos.x += 1.1 * card.scale.x;
                edgePos.project(camera);
                const edgeX = (edgePos.x * 0.5 + 0.5) * width;
                const projectedWidth = Math.abs(edgeX - x) * 2;
                return { id: card.userData.id, x: x, width: projectedWidth };
            });
            return { cards: cardData, viewportWidth: width };
        }""")

        browser.close()
        return True

if __name__ == "__main__":
    if verify_mobile_cards():
        exit(0)
    else:
        exit(1)
