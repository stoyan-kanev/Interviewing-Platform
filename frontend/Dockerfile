# --- Stage 1: Build Angular ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
# ако output ти е dist/frontend (виж логовете ти) – остави така
RUN npm run build -- --configuration production

# --- Stage 2: Runtime (NGINX) ---
FROM nginx:alpine
# копираме само server блока, не цял nginx.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
# копираме билднатия фронт
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
