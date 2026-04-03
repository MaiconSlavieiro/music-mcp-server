FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/

RUN npm run build

# Port is configured via PORT env var (default: 18960)

CMD ["node", "build/index.js"]
