
import asyncio
from playwright.async_api import async_playwright, expect
import logging
import subprocess
import sys
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_typewriter_timing():
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8081"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            logger.info("Navigating to app...")
            start_time = time.time()
            await page.goto("http://localhost:8081/index.html")

            # Wait for the typewriter container
            title_el = page.locator(".typewriter-title")
            await expect(title_el).to_be_visible()

            # Check for typed text presence
            typed_text = page.locator("#typedText")

            # We expect text to start appearing very quickly
            # Wait for any text content
            await expect(typed_text).not_to_be_empty(timeout=2000)

            elapsed = time.time() - start_time
            logger.info(f"TypeWriter text detected after {elapsed:.2f}s (includes page load)")

            # Take screenshot
            await page.wait_for_timeout(500) # Wait a bit for more text
            await page.screenshot(path="verification/typewriter_visible.png")
            logger.info("Screenshot captured: verification/typewriter_visible.png")

        except Exception as e:
            logger.error(f"Verification failed: {e}")
            raise e
        finally:
            server.terminate()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_typewriter_timing())
