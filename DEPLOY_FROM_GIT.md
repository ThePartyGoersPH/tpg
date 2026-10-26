# Deploy from Git (no hand-edited files on VPS)

## Rule
The VPS (`/var/www/my-project`) is ALWAYS updated with `git pull` from a tagged commit.
Never edit files directly on the server. All changes go through git on your machine, then PR/merge, then deploy.

## How to see which commit is live
On the VPS (read-only inspection):
```bash
cd /var/www/my-project
git rev-parse HEAD
git log -1 --oneline
git status --short          # should be empty (no uncommitted edits)
git branch --show-current
```
Compare the printed commit hash with the commit you intended to deploy. If they differ, or `git status` shows modifications, the server has drifted — re-deploy.

## Deploy procedure (run on VPS)
```bash
cd /var/www/my-project
# 1. Save nothing by hand; stash is forbidden. If dirty, investigate first:
git status --short
# 2. Fetch and checkout the exact commit you want live:
git fetch origin
git checkout <commit-hash-or-branch>
# 3. (backend) install deps if package.json changed, then restart PM2:
cd thesis-backend && npm ci && pm2 restart tpg-backend
# 4. (frontends) rebuild from the commit:
cd ../super_admin_web && npm ci && npm run build
# ... repeat for customer_website, manager, pos_website
# 5. Verify:
git rev-parse HEAD
```

## Local parity check
Before deploying, compare local to VPS with a dry-run (read-only):
```bash
rsync -avcn -e 'ssh -i ~/.ssh/tpg-key.pem' \
  --exclude node_modules --exclude .env --exclude .env.* --exclude uploads --exclude dist --exclude 'dist.*' --exclude private-uploads \
  ubuntu@168.107.95.8:/var/www/my-project/ /path/to/local/websites/
```
Any file listed means content differs — reconcile before deploying.
