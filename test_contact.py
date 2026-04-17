import threading
import http.server
import socketserver
import time
from playwright.sync_api import sync_playwright

PORT = 8000

Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("", PORT), Handler)

def start_server():
    httpd.serve_forever()

thread = threading.Thread(target=start_server, daemon=True)
thread.start()
time.sleep(1) # wait for server to start

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f'http://localhost:{PORT}/contact.html')

        page.fill('input#encomenda', '123 / 456789')
        page.select_option('select#motivo', 'artigo esquecido em loja')

        page.click('button[type="submit"]')

        page.wait_for_selector('#email_options', state='visible')

        gmail_href = page.get_attribute('#btn-gmail', 'href')
        outlook_href = page.get_attribute('#btn-outlook', 'href')
        default_href = page.get_attribute('#btn-default', 'href')

        assert "mail.google.com" in gmail_href, f"Gmail URL missing: {gmail_href}"
        assert "outlook.office.com" in outlook_href, f"Outlook URL missing: {outlook_href}"
        assert "mailto:" in default_href, f"Default mailto missing: {default_href}"

        print("Success! All buttons are visible and have correct hrefs:")
        print(f"Gmail: {gmail_href[:50]}...")
        print(f"Outlook: {outlook_href[:50]}...")
        print(f"Default: {default_href[:50]}...")

        browser.close()
finally:
    httpd.shutdown()
    httpd.server_close()
