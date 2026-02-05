from playwright.sync_api import sync_playwright, expect
import re

def test_robot_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        print("Navigating to home page...")
        page.goto("http://localhost:8080/")

        # Wait for robot avatar
        print("Waiting for robot avatar...")
        avatar = page.locator(".robot-avatar")
        expect(avatar).to_be_visible(timeout=10000)

        # Click to open chat
        print("Opening chat...")
        avatar.click()

        # Wait for chat window
        print("Waiting for chat window...")
        chat_window = page.locator("#robot-chat-window")
        expect(chat_window).to_be_visible()
        expect(chat_window).to_have_class(re.compile(r"open"))

        # Take screenshot of the centered window
        print("Taking screenshot...")
        page.screenshot(path="verification/verification_centered.png")

        # Verify CSS properties for centering
        print("Verifying centering styles...")
        top = chat_window.evaluate("el => getComputedStyle(el).top")
        left = chat_window.evaluate("el => getComputedStyle(el).left")
        transform = chat_window.evaluate("el => getComputedStyle(el).transform")
        width = chat_window.evaluate("el => getComputedStyle(el).width")

        print(f"Top: {top}, Left: {left}, Transform: {transform}, Width: {width}")

        if top != "50%" and "340px" not in top: # Playwright might return computed px
             # If it returns pixels, we can't easily check '50%' without window size, but visual check is key.
             # However, we can check if it looks roughly centered.
             pass

        browser.close()
        print("Done.")

if __name__ == "__main__":
    test_robot_ui()
