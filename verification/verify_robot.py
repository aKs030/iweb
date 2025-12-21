
import asyncio
from playwright.async_api import async_playwright, expect
import logging
import subprocess
import sys
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def verify_loading_robot():
    server = subprocess.Popen([sys.executable, "-m", "http.server", "8081"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        try:
            # We want to catch the loading screen.
            # We can use the interception technique from the previous task to force it to stay visible.
            await page.add_init_script("""
                Object.defineProperty(window, 'LoadingScreen', {
                    configurable: true,
                    enumerable: true,
                    get() { return this._LoadingScreen; },
                    set(val) {
                        this._LoadingScreen = val;
                        if (val && val.requestShow) {
                            val.requestShow('visual-verification');
                        }
                    }
                });
            """)

            logger.info("Navigating to app...")
            await page.goto("http://localhost:8081/index.html")

            # Wait for the loader to appear (it's in the initial HTML)
            loading_screen = page.locator("#loadingScreen")
            await expect(loading_screen).to_be_visible()

            # Take screenshot of the loading screen with the robot
            await page.screenshot(path="verification/robot_loading.png")
            logger.info("Screenshot captured: verification/robot_loading.png")

        except Exception as e:
            logger.error(f"Verification failed: {e}")
            raise e
        finally:
            server.terminate()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_loading_robot())
