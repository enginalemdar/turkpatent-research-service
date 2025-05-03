require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/search', async (req, res) => {
  const { searchText, next = 0, limit = 20 } = req.body;
  if (!searchText) {
    return res.status(400).json({ error: 'searchText is required' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();

    // Optional: gerçek bir tarayıcı davranışı taklidi için user-agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );

    await page.goto('https://www.turkpatent.gov.tr/arastirma-yap', { waitUntil: 'networkidle2' });

    // Invisible reCAPTCHA site key’i script tag’inden al
    const siteKey = await page.evaluate(() => {
      const script = Array.from(document.querySelectorAll('script[src]'))
        .find(s => s.src.includes('/reload?k='));
      const url = new URL(script.src);
      return url.searchParams.get('k');
    });

    // grecaptcha objesinin yüklenmesini bekle
    await page.waitForFunction('window.grecaptcha !== undefined');

    // reCAPTCHA token’ını al
    const token = await page.evaluate((key) => {
      return new Promise(resolve => {
        grecaptcha.ready(() => {
          grecaptcha.execute(key, { action: 'search' }).then(resolve);
        });
      });
    }, siteKey);

    // API için payload hazırla
    const payload = {
      type: 'trademark',
      params: {
        markTypeId: '0',
        searchText,
        searchTextOption: 'isContains',
        holderName: '',
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

    // /api/research endpoint’ine POST isteği
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
