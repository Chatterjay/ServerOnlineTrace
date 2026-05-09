FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p ssl && openssl req -x509 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem -days 3650 -nodes \
  -subj "/CN=tracesession"

EXPOSE 4560 4561

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && exec npx tsx src/index.ts"]
