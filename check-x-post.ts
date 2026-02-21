import { chromium } from 'playwright';

const NITTER_INSTANCES = [
  'nitter.poast.org',
  'nitter.privacydev.net',
  'nitter.mint.lgbt',
  'nitter.cz',
  'nitter.1d4.us',
  'xcancel.com',
  'nitter.lucabased.xyz'
];

async function checkXPost() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  // Try Nitter instances
  for (const instance of NITTER_INSTANCES) {
    const url = `https://${instance}/Tunaswiminsea/status/2014959581953458689`;
    console.log(`\nTrying Nitter instance: ${instance}...`);

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      if (response && response.status() === 200) {
        await page.waitForTimeout(3000);

        const screenshotPath = `/Users/nichikatanaka/Downloads/Nandemo-work-flow-main/nitter-${instance.replace(/\./g, '-')}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`Screenshot saved to: ${screenshotPath}`);

        const title = await page.title();
        console.log('Page title:', title);

        // Get tweet content
        try {
          const bodyText = await page.locator('body').innerText({ timeout: 5000 });
          console.log('\n--- Page Content ---\n');
          console.log(bodyText.slice(0, 4000));

          // If we got content, save and break
          if (bodyText.length > 100 && !bodyText.includes('Instance has been rate limited')) {
            console.log(`\n✅ Success with ${instance}!`);
            break;
          }
        } catch (e) {
          console.log('Could not get body text');
        }
      } else {
        console.log(`Failed with status: ${response?.status()}`);
      }
    } catch (e: any) {
      console.log(`Error: ${e.message?.slice(0, 100)}`);
    }
  }

  await browser.close();
}

checkXPost().catch(console.error);
