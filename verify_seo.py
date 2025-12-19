
import re
from playwright.sync_api import sync_playwright, expect

def verify_seo_changes(page):
    # 1. Verify Global Metadata on Homepage
    page.goto("http://localhost:8081/index.html")

    # Check Description
    meta_desc = page.locator('meta[name="description"]')
    expect(meta_desc).to_have_attribute("content", re.compile(r"Persönliches Portfolio und digitale Visitenkarte"))

    # Check Keywords
    meta_keywords = page.locator('meta[name="keywords"]')
    expect(meta_keywords).to_have_attribute("content", re.compile(r"Abdul Berlin"))

    # 2. Verify Typo Fix on Projects Page
    page.goto("http://localhost:8081/pages/projekte/projekte.html")

    # Wait for React to mount and text to appear
    headline = page.locator(".headline")
    expect(headline).to_be_visible()

    # Check for the space between spans
    # The text content of the parent h1 should be "Meine Projekte." with a space
    expect(headline).to_have_text("Meine Projekte.")

    # 3. Verify Specific Metadata on Projects Page
    project_desc = page.locator('meta[name="description"]')
    expect(project_desc).to_have_attribute("content", re.compile(r"Übersicht meiner privaten Web-Projekte"))

    # Take Screenshot of the Headline
    headline.screenshot(path="verification_headline.png")
    page.screenshot(path="verification_full_page.png")

    print("Verification Successful!")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_seo_changes(page)
        except Exception as e:
            print(f"Verification Failed: {e}")
            page.screenshot(path="verification_error.png")
        finally:
            browser.close()
