# 使用官方 Nginx 映像
FROM nginx:alpine

# 複製你的 Nginx 設定檔 (確保裡面有 include /etc/nginx/cloudflare_ips.conf;)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 複製 media 的內容到 Nginx 預設的靜態資源目錄
COPY media /usr/share/nginx/html/media

# 暴露 Nginx 的預設 HTTP 端口
EXPOSE 8090