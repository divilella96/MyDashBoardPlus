from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/mensagem.html")
    page.wait_for_timeout(1000)

    # Re-upload the image to test the other button
    file_input = page.locator('#imagem_encomenda')
    file_input.set_input_files("/tmp/file_attachments/image.png")
    page.wait_for_timeout(5000)

    # Wait for the button to appear and click the "Extrair Tudo" button
    page.locator('#btn-extrair-tudo').wait_for(state="visible", timeout=30000)
    page.locator('#btn-extrair-tudo').click()
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
