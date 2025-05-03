require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer-extra');
const RecaptchaPlugin = require('puppeteer-extra-plugin-recaptcha');
const axios = require('axios');
const bodyParser = require('body-parser');

// 2Captcha sağlayıcısını ayarla
puppeteer.use(
  RecaptchaPlugin({
    provider: { id: '2captcha', token: process.env.CAPTCHA_API_KEY },
    visualFeedback: true
  })
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/search', async (req, res) => {
  const { searchText, next = 0, limit = 20 } = req.body;
  if (!searchText) {
    return res.status(400).json({ error: 'searchText is required' });
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.turkpatent.gov.tr/arastirma-yap', { waitUntil: 'networkidle2' });

    // reCAPTCHA’yı çöz
    await page.solveRecaptchas();
    // grecaptcha token’ını yakala
    const token = await page.evaluate(() => grecaptcha.getResponse());

    // API payload
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
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
puppeteer.use(
  RecaptchaPlugin({
    provider: { id: '2captcha', token: process.env.CAPTCHA_API_KEY },
    visualFeedback: true,
+   solveInvisibleReCAPTCHAs: true    // Invisible reCAPTCHA’ları da çözülsün
  })
);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
