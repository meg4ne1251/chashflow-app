# ============================================
# Stage 1: Build frontend (React/Vite)
# ============================================
FROM node:20-alpine AS frontend-build

WORKDIR /build

COPY web/package.json web/package-lock.json* ./
RUN npm ci --ignore-scripts

COPY web/ ./
RUN npm run build

# ============================================
# Stage 2: Nginx with static files + config
# ============================================
FROM nginx:1.27-alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy frontend build output
COPY --from=frontend-build /build/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO /dev/null http://localhost/ || exit 1
