# Build stage — install deps and build frontend
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npx vite build

# Production stage — lean image with only what's needed
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    tini \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app/package.json ./package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/data ./data
COPY --from=build /app/public ./public
COPY start.sh ./
RUN chmod +x start.sh

ENV NODE_ENV=production
ENV DATA_DIR=/data

EXPOSE 8080
ENTRYPOINT ["tini", "--"]
CMD ["./start.sh"]
