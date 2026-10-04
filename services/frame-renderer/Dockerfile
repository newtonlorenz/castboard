FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && mkdir -p /home/pwuser/.cache && chown -R pwuser:pwuser /app /home/pwuser
COPY --chown=pwuser:pwuser renderer.js server.js ./
USER pwuser
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8791
EXPOSE 8791
CMD ["node", "server.js"]
