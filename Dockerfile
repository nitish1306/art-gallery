# Build stage
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
# 🔍 Debug (temporary, remove later)
RUN npm list vite
COPY . .
RUN npm run build
# Production stage
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/public ./public
COPY start.sh ./

RUN chmod +x start.sh

ENV NODE_ENV=production
ENV DATA_DIR=/data

EXPOSE 8080
ENTRYPOINT ["tini", "--"]
CMD ["./start.sh"]