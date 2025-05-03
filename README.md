# turkpatent-research-service

Bu servis, TurkPatent’in **invisible reCAPTCHA v2** korumalı araştırma sayfasını Puppeteer ile taklit ederek
otomatik token alır ve `/api/research` sonuçlarını JSON olarak döner.

## Endpoint

### POST /search

**İstek Gövdesi** (JSON)
```json
{
  "searchText": "unitplan",
  "next": 0,
  "limit": 20
}
