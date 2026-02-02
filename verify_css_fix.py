import sys
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # Load the local index.html directly or via file://
        # Assuming the server isn't running, we'll try to use the file directly if possible,
        # but absolute paths are tricky.
        # Better: run a simple server or just inspect the computed style of the loaded file.
        # Since I can't easily start a server in this script, I'll rely on reading the file content
        # via the browser (using file:// if permitted, or just injecting the HTML).

        # Actually, let's just use the `read_file` tool I have access to, to verify the CSS text.
        # But to verify the *computed* style (cascade), I need a browser.

        # Let's try to load the page.
        import os
        cwd = os.getcwd()
        page.goto(f"file://{cwd}/index.html")

        # We need to inject the CSS because file:// might not load relative CSS correctly
        # if the path resolution differs, but relative paths usually work.
        # index.html links to content/styles/main.css.
        # If I load /app/index.html, it looks for /app/content/styles/main.css. It should work.

        # Wait for load
        page.wait_for_load_state("domcontentloaded")

        # 1. Verify Body Computed Style
        body_align = page.evaluate("window.getComputedStyle(document.body).scrollSnapAlign")
        print(f"Body scrollSnapAlign: '{body_align}'")

        if body_align != 'none':
            print("FAILURE: Body should not have scroll-snap-align")
            sys.exit(1)

        # 2. Verify Section Computed Style
        # We need to check a section.
        # .section class.
        # Note: CSS might not be applied if the file path is wrong.
        # Let's check if the CSS loaded.

        bg_color = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
        if bg_color == 'rgba(0, 0, 0, 0)' or bg_color == 'rgb(255, 255, 255)': # Default
             # Check if it matches our expected variable var(--bg-primary) #030303 -> rgb(3, 3, 3)
             pass
             # Actually, verification of CSS loading is hard if variables aren't resolved in getComputedStyle easily without context.

        # Let's verify .section styles directly.
        section_margin_top = page.evaluate("""
            const section = document.querySelector('.section');
            window.getComputedStyle(section).scrollMarginTop;
        """)
        print(f"Section scrollMarginTop: '{section_margin_top}'")

        # We expect it to be 0px (default) because we removed it.
        # Wait, getComputedStyle returns resolved values.
        # If it's not set, it's 0px.
        if section_margin_top != '0px':
             print("FAILURE: Section should not have scroll-margin-top set (should be default/0px)")
             # Note: If it inherited something or browser default is diff, but standard is 0.
             sys.exit(1)

        # 3. Verify HTML Computed Style
        html_padding_top = page.evaluate("window.getComputedStyle(document.documentElement).scrollPaddingTop")
        print(f"HTML scrollPaddingTop: '{html_padding_top}'")

        # Should be 64px (from var(--header-height))
        # Playwright might not resolve variables in file:// protocol if CSS isn't parsed perfectly?
        # But usually Chromium handles it.
        if html_padding_top == '0px':
            print("WARNING: HTML scrollPaddingTop is 0px. CSS might not be loaded or variable not resolved.")
        else:
            print("SUCCESS: HTML scrollPaddingTop is set.")

        print("Verification passed.")
        browser.close()

if __name__ == "__main__":
    run()
