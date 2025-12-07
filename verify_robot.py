from playwright.sync_api import sync_playwright

def verify_robot():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto("http://localhost:8081/")

        # Inject style to disable animations
        page.add_style_tag(content="* { animation: none !important; transition: none !important; }")

        # Wait for robot to appear
        page.wait_for_selector("#robot-companion-container")

        # Take a screenshot of the robot area
        element = page.locator("#robot-companion-container")
        element.screenshot(path="robot_verification.png")

        # Click the robot to open chat (force click to bypass stability check if needed, but animation disable should help)
        page.click(".robot-avatar", force=True)

        # Wait for chat window
        page.wait_for_selector("#robot-chat-window.open")
        page.wait_for_timeout(500)

        # Take screenshot of open chat
        page.screenshot(path="robot_chat_verification.png")

        print("Verification screenshots captured.")
        browser.close()

if __name__ == "__main__":
    verify_robot()
