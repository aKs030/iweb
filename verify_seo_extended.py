
import re
from playwright.sync_api import sync_playwright, expect

def verify_extended_seo(page):
    # 1. Verify Gallery Page Tone
    page.goto("http://localhost:8081/pages/gallery/gallery.html")

    # Check Description for "Private" tone
    meta_desc = page.locator('meta[name="description"]')
    expect(meta_desc).to_have_attribute("content", re.compile(r"Private Fotogalerie"))
    expect(meta_desc).not_to_have_attribute("content", re.compile(r"Professionell"))

    # Check Keywords
    meta_keywords = page.locator('meta[name="keywords"]')
    expect(meta_keywords).to_have_attribute("content", re.compile(r"Hobby"))

    # 2. Verify Cards Page (Fix for broken template)
    page.goto("http://localhost:8081/pages/cards/index.html")

    # Check Title
    expect(page).to_have_title("Interessen & Skills")

    # Check if cards are visible (means it's not a template anymore)
    card_title = page.locator(".card-title").first
    expect(card_title).to_be_visible()
    expect(card_title).to_have_text("Über mich")

    # Check Metadata
    card_desc = page.locator('meta[name="description"]')
    expect(card_desc).to_have_attribute("content", re.compile(r"Privates Portfolio"))

    print("Extended SEO Verification Successful!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_extended_seo(page)
        except Exception as e:
            print(f"Verification Failed: {e}")
            page.screenshot(path="verification_error_extended.png")
            raise e
        finally:
            browser.close()
