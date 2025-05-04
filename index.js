const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer-core');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

// ortak fonksiyon: invisible reCAPTCHA token alır
async function getRecaptchaToken(page) {
  // 1) siteKey çıkar
  const siteKey = await page.evaluate(() => {
    const tag = Array.from(document.querySelectorAll('script[src]'))
      .find(s => s.src.includes('api.js?render='));
    if (!tag) throw new Error('reCAPTCHA siteKey bulunamadı');
    return new URL(tag.src).searchParams.get('render');
  });
  // 2) grecaptcha yüklenene kadar bekle
  await page.waitForFunction('window.grecaptcha !== undefined');
  // 3) token üret
  return await page.evaluate((key) => {
    return new Promise(resolve => {
      grecaptcha.ready(() =>
        grecaptcha.execute(key, { action: 'search' })
          .then(resolve)
      );
    });
  }, siteKey);
}

// -------------- MARKA ARAMA --------------
app.post('/search', async (req, res) => {
  const { searchText = '', holderName = '', next = 0, limit = 20 } = req.body;
  if (!searchText.trim() && !holderName.trim()) {
    return res.status(400).json({
      error: 'searchText veya holderName’dan en az biri gereklidir'
    });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome-stable',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

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
      type: 'trademark',
      params: {
        markTypeId: '0',
        searchText,
        searchTextOption: 'isContains',
        holderName,
        holderNameOption: 'isStartWith',
        bulletinNo: '',
        gazzetteNo: '',
        clientNo: '',
        niceClasses: '',
        niceClassesFor: 'all'
      },
      next,
      limit,
      order: null,
      token
    };

    const response = await axios.post(
      'https://www.turkpatent.gov.tr/api/research',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Origin:    'https://www.turkpatent.gov.tr',
          Referer:   'https://www.turkpatent.gov.tr/arastirma-yap'
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

// -------------- DOSYA DETAYLARI --------------
app.post('/file-details', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'id (applicationNo) gereklidir' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: '/usr/bin/google-chrome-stable',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
      ]
    });

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
          Origin:    'https://www.turkpatent.gov.tr',
          Referer:   'https://www.turkpatent.gov.tr/arastirma-yap'
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
