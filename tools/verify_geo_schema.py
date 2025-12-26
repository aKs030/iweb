import sys
import threading
import http.server
import socketserver
from playwright.sync_api import sync_playwright
import time
import json

PORT = 8081

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress logs

def run_server():
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        httpd.serve_forever()

def verify_geo_schema():
    # Start server
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(1)  # Wait for server

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox'])
        page = browser.new_page()

        try:
            page.goto(f'http://localhost:{PORT}/index.html')

            # Wait for schema injection (it uses requestIdleCallback/setTimeout)
            page.wait_for_selector('#head-complete-ldjson', state='attached', timeout=5000)

            # Extract JSON-LD
            json_ld_content = page.evaluate('''() => {
                const el = document.getElementById('head-complete-ldjson');
                return el ? el.textContent : null;
            }''')

            if not json_ld_content:
                print("FAIL: JSON-LD script tag not found or empty.")
                sys.exit(1)

            data = json.loads(json_ld_content)
            graph = data.get('@graph', [])

            # --- Validation Checks ---

            # 1. Organization (ProfessionalService)
            org = next((item for item in graph if item.get('@type') == 'ProfessionalService'), None)
            if not org:
                print("FAIL: ProfessionalService entity not found.")
                sys.exit(1)

            # Check Geo
            geo = org.get('geo')
            if not geo:
                print("FAIL: 'geo' missing in ProfessionalService.")
                sys.exit(1)
            if geo.get('latitude') != '52.5733' or geo.get('longitude') != '13.2911':
                print(f"FAIL: Geo coordinates mismatch. Got {geo}")
                sys.exit(1)
            print("PASS: Organization Geo coordinates correct.")

            # Check Address
            addr = org.get('address')
            if not addr:
                print("FAIL: Address missing in ProfessionalService.")
                sys.exit(1)
            if 'streetAddress' in addr:
                print(f"FAIL: 'streetAddress' should not be present (refined to remove 'Reinickendorf'). Got: {addr['streetAddress']}")
                sys.exit(1)
            if addr.get('addressLocality') != 'Berlin' or addr.get('postalCode') != '13507':
                print(f"FAIL: Address details incorrect. Got: {addr}")
                sys.exit(1)
            print("PASS: Organization Address structure refined.")

            # 2. Person
            person = next((item for item in graph if isinstance(item.get('@type'), list) and 'Person' in item.get('@type')), None)
            if not person:
                print("FAIL: Person entity not found.")
                sys.exit(1)

            # Check HomeLocation
            home = person.get('homeLocation')
            if not home:
                print("FAIL: 'homeLocation' missing in Person.")
                sys.exit(1)
            if home.get('name') != 'Berlin':
                print(f"FAIL: homeLocation name mismatch. Got {home.get('name')}")
                sys.exit(1)
            print("PASS: Person homeLocation present.")

            print("\nSUCCESS: All schema validations passed.")

        except Exception as e:
            print(f"ERROR: {e}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_geo_schema()
