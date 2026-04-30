# Простейший single-stage образ: nginx + готовая dist/.
# Билд (npm run build) делается ДО docker build на том же хосте.
# Та же схема, что у runner-web.

FROM nginx:1.27-alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
