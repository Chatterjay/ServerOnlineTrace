FROM node:22-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma

# Patch schema.prisma: replace env() with hardcoded provider for build
RUN sed -i 's/env("DATABASE_PROVIDER")/"sqlite"/' prisma/schema.prisma && \
    npx prisma generate && \
    sed -i 's/"sqlite"/env("DATABASE_PROVIDER")/' prisma/schema.prisma

COPY . .

RUN mkdir -p ssl && openssl req -x509 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem -days 3650 -nodes \
  -subj "/CN=tracesession"

EXPOSE 27890 27891

CMD ["node", "startup.mjs"]
