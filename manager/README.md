# Bar Operations Web (Manager Portal)

React + Vite web application used by bar owners, HR, and staff to run day-to-day operations.

## Main Modules

- Authentication and account setup
- Dashboard and operational KPIs
- Bar profile and branch management
- Menu, inventory, packages, and table management
- Reservations and events
- Staff, attendance, leaves, documents, and payroll
- Promotions and customer moderation
- Analytics, financials, audit logs, and subscriptions

## Tech Stack

- React 19
- Vite 6
- React Router 7
- Zustand
- Tailwind CSS
- Axios

## Requirements

- Node.js 18+
- Backend API from `thesis-backend` running (default: `http://localhost:3000`)

## Local Development

```bash
npm install
npm run dev
```

Default local URL is printed by Vite (commonly `http://localhost:5173`).

## Build and Preview

```bash
npm run build
npm run preview
```

## Security and Access Notes

- Route-level protection uses authenticated sessions plus permission checks.
- Sensitive payroll fields (daily salary) are masked for unauthorized roles.
- Staff self-service restrictions prevent self-role and self-status escalation.

## Related Apps

- Customer web: `customer_website`
- Super admin portal: `super_admin_web`
- API backend: `thesis-backend`

## Status

- Production feature set implemented for core bar operations workflows.
- Keep this README aligned with `src/App.jsx` route modules when adding new pages.
