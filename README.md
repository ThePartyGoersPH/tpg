# Platform Bar - React Customer Website

React + Vite customer-facing website connected to the existing Platform Bar System backend.

## Tech Stack

- React (component-based)
- Vite
- Axios
- React Router
- JWT auth via `Authorization: Bearer <token>`

## Customer-Only Access Rule

Login is role-gated. If authenticated `user.role` is not `customer`, access is blocked with:

> You do not have permission to use the customer website.

Implemented in:
- `src/services/authService.js`
- `src/contexts/AuthContext.jsx`
- `src/components/auth/ProtectedRoute.jsx`

## Implemented Features

- Customer registration and login
- Customer-only role guard
- Home (trending bars + platform announcements)
- Browse bars with filters and search
- Bar detail page:
  - follow/unfollow bar
  - bar menu
  - bar location map and directions
  - events list + like events
  - review list + submit/update/delete review
  - reservation form + available tables checking
- Events feed (cross-bar events + comments)
- Reservation history + cancellation
- Profile management (details, password, profile picture)

## API Modules

Located in `src/api/`:

- `authApi.js`
- `barApi.js`
- `eventApi.js`
- `reservationApi.js`
- `reviewApi.js`
- `socialApi.js`
- `client.js` (Axios instance + JWT interceptor)

## Project Structure

```
src/
  api/
  components/
    auth/
    bars/
    events/
    layout/
    reservations/
    reviews/
    ui/
  contexts/
  hooks/
  layouts/
  pages/
  services/
  utils/
  App.jsx
  main.jsx
```

## Environment Variables

Copy `.env.example` to `.env` and set backend base URL:

```
VITE_API_URL=http://localhost:3000
```

## Run the Project

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Open the URL shown by Vite (usually `http://localhost:5173`).

## Production Build

```bash
npm run build
npm run preview
```


## Why local and online can look different

If the local app looks different from the deployed version, check these in order:

1. **Git branch/commit**: Run `git branch --show-current` and `git log -1 --oneline`. Ensure local is on `main` and up to date with `origin/main`. Compare with the server: `cd /var/www/my-project && git log -1 --oneline`.
2. **Multiple frontends**: The repo has 5 Vite apps (customer_website:5173, manager:5174, super_admin_web:5175, pos_website:4173, _deploy_customer_notifications:5173). Make sure you are running the correct one.
3. **Routing/base path**: The customer app uses `base: '/'` in vite.config.js (matching online root path). If you see 404s for assets, check that `base` matches the URL path you are opening.
4. **Environment variables**: Ensure `.env.development.local` has `VITE_API_URL=http://localhost:3000` (no trailing `/api`). The production build uses `VITE_API_URL=https://thepartygoers.partygoers.online/api`.
5. **Theme**: The default theme is `dark`. The inline script in `index.html` sets `data-theme` from localStorage (defaulting to `dark`). Clear localStorage if you see a stale theme.
6. **Fonts**: The app loads fonts from Google Fonts CDN (matching online). If fonts look wrong, check the `<link>` tags in `index.html`.
7. **Browser cache**: Do a hard refresh (Cmd+Shift+R / Ctrl+Shift+R) to clear cached assets.
8. **Build version**: Check the console for `[BUILD] version:` to compare local vs online builds.

### Preview production build locally

```bash
npm run preview:prod
```

This builds with production env and serves on port 4173, exactly like the deployed version.