// index.js

const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/**
 * Launch Puppeteer with system Chrome
 */
async function launchBrowser() {
  return await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });
}

/**
 * Extract reCAPTCHA token from TurkPatent research page
 */
async function getRecaptchaToken(page) {
  // 1) Extract site key from the script tag
  const siteKey = await page.evaluate(() => {
    const tag = Array.from(document.querySelectorAll('script[src]'))
      .find(s => s.src.includes('api.js?render='));
    if (!tag) throw new Error('reCAPTCHA site key not found');
    return new URL(tag.src).searchParams.get('render');
  });

  // 2) Wait until grecaptcha is loaded
  await page.waitForFunction('window.grecaptcha !== undefined');

  // 3) Execute grecaptcha to get the token
  const token = await page.evaluate(key => {
    return new Promise(resolve => {
      grecaptcha.ready(() => {
        grecaptcha.execute(key, { action: 'search' }).then(resolve);
      });
    });
  }, siteKey);

  return token;
}

/**
 * POST /search
 * Body: {
 *   type: string,               // e.g. 'trademark'
 *   params: object,             // any params: searchText, holderName, niceClasses, etc.
 *   next: number,
 *   limit: number,
 *   order: any
 * }
 */
app.post('/search', async (req, res) => {
  const {
    type = 'trademark',
    params = {},
    next = 0,
    limit = 20,
    order = null
  } = req.body;

  // Validate: at least one filter must be provided
  const hasFilter =
    (params.searchText && params.searchText.trim()) ||
    (params.holderName && params.holderName.trim()) ||
    (params.clientNo && params.clientNo.trim()) ||
    (params.niceClasses && params.niceClasses.trim());

  if (!hasFilter) {
    return res.status(400).json({
      error:
        'At least one of searchText, holderName, clientNo or niceClasses is required'
    });
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    // Fake a real user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );

    // Navigate to the research page
    await page.goto('https://www.turkpatent.gov.tr/arastirma-yap', {
      waitUntil: 'networkidle2'
    });

    // Get the invisible reCAPTCHA token
    const token = await getRecaptchaToken(page);

    // Build the payload, passing through all params
    const payload = { type, params, next, limit, order, token };

    // Call TurkPatent API
    const response = await axios.post(
      'https://www.turkpatent.gov.tr/api/research',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://www.turkpatent.gov.tr',
          Referer: 'https://www.turkpatent.gov.tr/arastirma-yap'
        }
      }
    );

    await browser.close();
    res.json(response.data);
  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /file-details
 * Body: { id: string }  // applicationNo
 */
app.post('/file-details', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id (applicationNo) is required' });
  }

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto('https://www.turkpatent.gov.tr/arastirma-yap', {
      waitUntil: 'networkidle2'
    });

    const token = await getRecaptchaToken(page);

    const payload = {
      type: 'trademark-file',
      params: { id: String(id) },
      token
    };

    const response = await axios.post(
      'https://www.turkpatent.gov.tr/api/research',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://www.turkpatent.gov.tr',
          Referer: 'https://www.turkpatent.gov.tr/arastirma-yap'
        }
      }
    );

    await browser.close();
    res.json(response.data);
  } catch (err) {
    if (browser) await browser.close();
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
