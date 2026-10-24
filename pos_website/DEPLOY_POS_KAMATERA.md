# POS Website Deployment (Kamatera)

## Domain
- https://pos.thepartygoers.fun

## VPS Paths
- Web root: /var/www/pos/dist
- Nginx site: /etc/nginx/sites-available/pos.thepartygoers.fun.conf
- Nginx enabled: /etc/nginx/sites-enabled/pos.thepartygoers.fun.conf

## Local Build
Run from pos_website:

npm run build

## Upload
scp -r dist/* root@114.29.237.62:/var/www/pos/dist/
ssh root@114.29.237.62 "chown -R www-data:www-data /var/www/pos"

## Verify
curl -I https://pos.thepartygoers.fun

## Notes
- SSL certificate is managed by Certbot and already installed.
- HTTP is redirected to HTTPS.
- Renewal is handled automatically by Certbot scheduled task.
