
import os
from playwright.sync_api import sync_playwright, expect

def test_search_history():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to home page...")
            page.goto("http://localhost:8080")

            # Wait for potential loader to disappear
            try:
                # Assuming loader has class .loader-container or similar from base-loader.html
                # Checking base-loader.html content would be ideal, but usually it's a full screen overlay
                page.wait_for_selector("body:not(.loading)", timeout=5000)
            except:
                print("Body loading class wait timed out or not present")

            # Wait for network idle to ensure scripts loaded
            page.wait_for_load_state("networkidle")

            # Give a bit more time for JS initialization
            page.wait_for_timeout(2000)

            print("Opening search...")
            page.evaluate("window.openSearch()")

            # Wait for overlay animation
            page.wait_for_timeout(500)

            print("Typing search query...")
            search_input = page.locator("#search-input")
            expect(search_input).to_be_visible()

            search_input.fill("Playwright Test")
            # Trigger search (debounce is 300ms)
            page.wait_for_timeout(1000)

            # Wait for results
            results = page.locator(".search-results")
            expect(results).to_contain_text("Playwright Test") # Mock returns query in title/desc

            print("Closing search...")
            page.evaluate("window.closeSearch()")
            page.wait_for_timeout(500)

            print("Re-opening search to check history...")
            page.evaluate("window.openSearch()")

            # Wait for history render
            page.wait_for_timeout(500)

            # Expect history item
            history_item = page.locator(".history-item")
            expect(history_item).to_contain_text("Playwright Test")

            print("Taking screenshot...")
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/search_history_v2.png")
            print("Verification successful!")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_v2.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    test_search_history()
