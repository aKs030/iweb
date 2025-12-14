
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        # Navigate to the page
        await page.goto("http://localhost:8081/index.html")

        # Wait for the page to load
        await page.wait_for_load_state("networkidle")

        # The cards are in the 'features' section. We need to scroll there.
        # Assuming the features section has an ID or recognizable selector.
        # Based on cards.js: originalCards = sectionElement.querySelectorAll('.features-cards .card')
        # We can try to scroll to '.features-cards' or a section that contains it.
        # Let's try scrolling to the section that triggers the cards.

        # We might need to wait for the Earth system to initialize.
        await page.wait_for_timeout(3000)

        # Scroll to the cards area
        # Finding the element that matches '.features-cards'
        try:
             # Force the cards to be visible or trigger the section
             # In many 3D scrollers, it's about scroll position.
             # Let's try to find the section with cards.
             cards_section = page.locator(".features-cards")
             if await cards_section.count() > 0:
                 await cards_section.first.scroll_into_view_if_needed()
                 await page.wait_for_timeout(2000) # Wait for animation
             else:
                 print("Could not find .features-cards, scrolling down manually")
                 await page.mouse.wheel(0, 2000)
                 await page.wait_for_timeout(2000)
        except Exception as e:
            print(f"Error navigating: {e}")

        # Take a screenshot
        await page.screenshot(path="verification_before.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
