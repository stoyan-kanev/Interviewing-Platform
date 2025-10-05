# ---------- Node.js WebSocket Server ----------
FROM node:20-alpine
WORKDIR /app
COPY package*.json /app/
RUN npm ci --omit=dev || npm install --omit=dev
COPY . /app
ENV NODE_ENV=production
EXPOSE 8001
CMD ["node", "server.js"]
