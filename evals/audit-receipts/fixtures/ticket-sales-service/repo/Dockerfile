FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY bin ./bin
COPY src ./src
COPY migrations ./migrations

RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

# The same image runs the worker with: node src/worker/index.js
CMD ["node", "src/server.js"]
