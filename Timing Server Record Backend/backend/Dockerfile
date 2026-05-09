FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma

# Build-time defaults for prisma generate (overridden at runtime by env)
ENV DATABASE_PROVIDER=sqlite
ENV DATABASE_URL=file:./data/tracesession.db
RUN npx prisma generate

COPY . .

RUN mkdir -p ssl && openssl req -x509 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem -days 3650 -nodes \
  -subj "/CN=tracesession"

EXPOSE 27890 27891

CMD ["node", "startup.mjs"]
