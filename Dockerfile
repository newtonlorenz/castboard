FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node package.json LICENSE README.md SECURITY.md castboard.config.example.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node plugins ./plugins
COPY --chown=node:node screen-types ./screen-types
COPY --chown=node:node cast-protocols ./cast-protocols
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node docs ./docs

RUN mkdir -p /data && chown node:node /data && chmod +x /app/scripts/docker-entrypoint.sh

ENV NODE_ENV=production
ENV CASTBOARD_CONFIG=/data/castboard.config.json
USER node
EXPOSE 8787
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8787/api/health || exit 1

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]
