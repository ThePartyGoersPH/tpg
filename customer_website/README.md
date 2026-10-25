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
