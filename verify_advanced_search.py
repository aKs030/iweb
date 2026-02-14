
import os
import time
from playwright.sync_api import sync_playwright, expect

def test_advanced_search():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        try:
            print("Navigating to home page...")
            page.goto("http://localhost:8080")

            # Wait for loader to disappear
            try:
                page.wait_for_selector("body:not(.loading)", timeout=5000)
            except:
                pass

            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(2000)

            print("Opening search...")
            page.evaluate("window.openSearch()")
            page.wait_for_timeout(500)

            # 1. Test Quick Actions
            print("Testing Quick Actions...")
            search_input = page.locator("#search-input")
            expect(search_input).to_be_visible()

            search_input.fill("go to pro")
            page.wait_for_timeout(500) # Wait for debounce

            quick_actions = page.locator(".search-quick-actions")
            expect(quick_actions).to_be_visible()
            expect(quick_actions).to_contain_text("Projekte")

            # 2. Test Trending Search (Empty Input)
            print("Testing Trending Search...")
            search_input.fill("")
            page.wait_for_timeout(500)

            trending = page.locator(".trending-item")
            # Might not be visible immediately if history is present, but let's check
            # In our implementation, trending shows if history is empty.
            # Since we haven't searched yet in this session (and assuming clean localStorage for incognito context), trending should show.
            expect(trending.first).to_be_visible()

            print("Taking screenshot...")
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/advanced_search.png")
            print("Verification successful!")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/error_advanced.png")
            raise e
        finally:
            browser.close()

if __name__ == "__main__":
    test_advanced_search()
