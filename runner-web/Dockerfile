# Простейший single-stage образ: только nginx + готовая dist/.
# Билд (npm run build) делается ДО сборки образа на том же хосте.
# Это самый дешёвый вариант — образ ~25 MB, никакого Node на сервере.

FROM nginx:1.27-alpine
COPY dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
