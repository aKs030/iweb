
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        # Navigate to the page
        await page.goto("http://localhost:8081/index.html")

        # Wait for load
        await page.wait_for_load_state("networkidle")

        # Wait for the Earth system to initialize
        await page.wait_for_timeout(3000)

        # Scroll/Find cards
        try:
             cards_section = page.locator(".features-cards")
             if await cards_section.count() > 0:
                 await cards_section.first.scroll_into_view_if_needed()
                 await page.wait_for_timeout(2000) # Wait for animation/lookAt to settle
             else:
                 print("Could not find .features-cards, scrolling down manually")
                 await page.mouse.wheel(0, 2000)
                 await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Error navigating: {e}")

        # Take a screenshot
        await page.screenshot(path="verification_after.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
