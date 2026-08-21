FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node . .

ENV NODE_ENV=production
USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8787/api/health || exit 1

CMD ["node", "src/server.js"]
