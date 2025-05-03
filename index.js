const express = require('express');
const axios = require('axios');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON gövdesi parse etmek için
app.use(express.json());

app.post('/search', async (req, res) => {
  const { searchText, next = 0, limit = 20 } = req.body;
  if (!searchText) {
    return res.status(400).json({ error: 'searchText is required' });
  }

  let browser;
  try {
    // 1) Gerçek Chrome taklidiyle Puppeteer başlat
    browser = await puppeteer.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/114.0.0.0 Safari/537.36'
    );

    // 2) Araştırma sayfasını yükle
    await page.goto('https://www.turkpatent.gov.tr/arastirma-yap', { waitUntil: 'networkidle2' });

    // 3) Sayfadaki <script src="…/reload?k=…"> içinden siteKey'i çıkar
    const siteKey = await page.evaluate(() => {
      const tag = Array.from(document.querySelectorAll('script[src]'))
        .find(s => s.src.includes('/reload?k='));
      return new URL(tag.src).searchParams.get('k');
    });

    // 4) grecaptcha objesinin yüklenmesini bekle
    await page.waitForFunction('window.grecaptcha !== undefined');

    // 5) grecaptcha.execute ile invisible token'ı al
    const token = await page.evaluate((key) => {
      return new Promise(resolve => {
        grecaptcha.ready(() => {
          grecaptcha.execute(key, { action: 'search' }).then(resolve);
        });
      });
    }, siteKey);

    // 6) TürkPatent API payload'unu hazırla
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

    // 7) API çağrısını yap ve cevabı al
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

    // 8) Tarayıcıyı kapat ve cevabı ilet
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
