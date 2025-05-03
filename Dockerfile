# 1) Base image olarak Node 18 slim kullanıyoruz
FROM node:18-slim

# 2) Chrome bağımlılıklarını ve Google Chrome Stable'ı kur
RUN apt-get update \
 && apt-get install -y wget gnupg ca-certificates --no-install-recommends \
 && wget -qO- https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
 && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google.list \
 && apt-get update \
 && apt-get install -y google-chrome-stable --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*

# 3) Çalışma dizinini ayarla
WORKDIR /app

# 4) Sadece production bağımlılıklarını yükle
COPY package.json ./
RUN npm install --omit=dev

# 5) Kaynak kodu kopyala
COPY . .

# 6) Konteyner ayağa kalkınca çalışacak komut
CMD ["npm", "start"]
