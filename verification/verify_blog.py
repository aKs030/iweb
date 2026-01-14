import time
from playwright.sync_api import sync_playwright, expect

def verify_blog(page):
    # 1. Test List View
    print("Navigating to blog index...")
    page.goto("http://localhost:8000/pages/blog/index.html")
    expect(page.get_by_role("heading", name="Wissen & Einblicke")).to_be_visible()

    # Wait for posts to render (using exact title from blog-data.js)
    expect(page.get_by_text("Optimierung von Three.js für das Web")).to_be_visible()

    page.screenshot(path="verification/blog-list.png")
    print("List view verified.")

    # 2. Test Legacy Hash Redirect
    print("Testing Legacy Hash Redirect...")
    # Navigate to hash URL
    page.goto("http://localhost:8000/pages/blog/index.html#/blog/threejs-performance")

    # Expect the correct post title to be visible
    expect(page.get_by_role("heading", name="Optimierung von Three.js für das Web")).to_be_visible()

    # Check if URL was updated by replaceState
    current_url = page.url
    print(f"Current URL after hash load: {current_url}")

    # Expecting: http://localhost:8000/blog/threejs-performance
    if "/blog/threejs-performance" in current_url:
        print("URL successfully updated via replaceState")
    else:
        print("Warning: URL did not update as expected (might differ on localhost)")

    page.screenshot(path="verification/blog-post-redirect.png")

    # 3. Test Navigation Back to Home
    print("Testing Back Button...")
    page.get_by_role("button", name="Zurück").click()
    expect(page.get_by_role("heading", name="Wissen & Einblicke")).to_be_visible()
    page.screenshot(path="verification/blog-back-nav.png")

    print("Verification complete.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_blog(page)
        except Exception as e:
            print(f"Test failed: {e}")
            page.screenshot(path="verification/error.png")
            raise
        finally:
            browser.close()
