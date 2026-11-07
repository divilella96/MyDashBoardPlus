const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('file://' + process.cwd() + '/index.html');

  // Check if Rato is absent
  const ratoHeader = await page.locator('h2', { hasText: 'Rato' }).count();
  if (ratoHeader > 0) {
    console.error('Test failed: Rato header is still present.');
  } else {
    console.log('Test passed: Rato header is absent.');
  }

  // Check if São Bento's new button is visible
  const saoBentoCcButton = await page.locator('button', { hasText: 'São Bento - Encomendas e C&C' }).count();
  if (saoBentoCcButton > 0) {
    console.log('Test passed: São Bento - Encomendas e C&C button is present.');
  } else {
    console.error('Test failed: São Bento - Encomendas e C&C button is missing.');
  }

  // Take a screenshot
  await page.screenshot({ path: 'frontend_screenshot.png', fullPage: true });

  await browser.close();
})();
