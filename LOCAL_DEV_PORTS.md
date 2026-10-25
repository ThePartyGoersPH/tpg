# Local dev ports (fixed — `strictPort: true`, no auto-switching)

| App | URL | Start command |
|---|---|---|
| Customer website | http://localhost:5173 | `cd customer_website && npm run dev` |
| Manager (bar owner) | http://localhost:5174 | `cd manager && npm run dev` |
| Super admin | http://localhost:5175 | `cd super_admin_web && npm run dev` |
| POS | http://localhost:4173 | `cd pos_website && npm run dev` |
| Backend API | http://localhost:3000 | `cd thesis-backend && npm run dev` |

No subpaths in dev (`/manager`, `/admin`, `/pos` only exist in production
builds). If a port is taken, Vite now errors instead of silently moving —
free it first:

```bash
npm run kill-ports   # kills 5173, 5174, 5175, 4173 (backend :3000 untouched)
```

Notes:
- Customer dev can use relative `/api` (Vite proxies to :3000, no CORS);
  leave `VITE_API_URL` empty for that, or keep the absolute localhost URL.
- Cross-portal login guards redirect by role (super admin → :5175,
  bar-side → :5174, customer stays on :5173), so use one Chrome profile
  per role while testing.
