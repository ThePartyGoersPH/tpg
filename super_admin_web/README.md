# 🌐 Super Admin Web Portal

**Platform Bar Management System - Super Admin Dashboard**

A comprehensive React-based web application for managing the entire Platform Bar Management System. This portal provides Super Admins with complete visibility and control over bars, payments, subscriptions, users, and platform operations.

---

## 📋 Features

### ✅ Implemented Features

- **🏠 Dashboard** - Platform overview with key metrics and charts
- **💳 Payment Monitoring** - Track all customer transactions across the platform
- **💰 Payout Management** - Process and manage bar owner payouts with bulk actions
- **🏢 Bar Management** - Approve, suspend, and manage all bars and branches
- **📦 Subscription Management** - Manage subscription plans and approvals
- **👥 User Management** - View and manage all platform users
- **🚫 Customer Banning** - Global and per-bar customer ban management
- **📋 Audit Logs** - Platform-wide activity logs and Super Admin actions

### ✅ Additional Implemented Pages

- Revenue analytics
- Platform feedback moderation
- Social moderation tools
- Registration approval workflow
- Permit monitoring
- System settings

---

## 🛠️ Technology Stack

- **React 19** - UI framework
- **Vite 8** - Build tool and dev server
- **React Router v7** - Routing
- **Zustand** - State management
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **date-fns** - Date formatting
- **React Hook Form + Zod** - Form handling
- **Recharts** - Charts and data visualization
- **Lucide React** - Icons
- **React Hot Toast** - Notifications

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ installed
- Backend API running on `http://localhost:3000`
- Super Admin account in the database

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_NAME=Super Admin Portal
```

3. **Start the development server:**
```bash
npm run dev
```

The application will be available at `http://localhost:5174/`

---

## 📁 Project Structure

```
src/
├── api/                    # API configuration
│   └── axios.js           # Axios instance with interceptors
├── components/            # Reusable components
│   ├── common/           # Common UI components
│   │   └── StatusBadge.jsx
│   ├── layout/           # Layout components
│   │   ├── Layout.jsx
│   │   ├── Navbar.jsx
│   │   └── Sidebar.jsx
│   └── ProtectedRoute.jsx
├── pages/                 # Page components
│   ├── AuditLogs.jsx
│   ├── Banning.jsx
│   ├── Bars.jsx
│   ├── Dashboard.jsx
│   ├── Login.jsx
│   ├── Payments.jsx
│   ├── Payouts.jsx
│   ├── Subscriptions.jsx
│   └── Users.jsx
├── stores/                # Zustand stores
│   └── authStore.js
├── utils/                 # Utility functions
│   └── formatters.js
├── App.jsx               # Main app component
├── main.jsx              # Entry point
└── index.css             # Global styles
```

---

## 🔐 Authentication

The application uses JWT-based authentication with the following flow:

1. User logs in with email and password
2. Backend validates credentials and checks for `SUPER_ADMIN` role
3. JWT token is stored in localStorage
4. All API requests include the token in Authorization header
5. Protected routes redirect to login if not authenticated

**Default Super Admin Login:**
- Email: Set up via backend
- Password: Set up via backend

---

## 🌐 Backend Integration

### API Base URL
```
http://localhost:3000
```

### Main Endpoints Used

**Authentication:**
- `POST /auth/login`

**Dashboard:**
- `GET /super-admin/dashboard/overview`

**Bars:**
- `GET /super-admin/bars`
- `POST /super-admin/bars/:id/approve`
- `POST /super-admin/bars/:id/suspend`
- `POST /super-admin/bars/:id/reactivate`

**Payments:**
- `GET /super-admin-payments/transactions`
- `GET /super-admin-payments/payouts`
- `POST /super-admin-payments/payouts/:id/mark-sent`
- `POST /super-admin-payments/payouts/bulk-mark-sent`

**Subscriptions:**
- `GET /super-admin/subscription-plans`
- `GET /super-admin/subscription-approvals`
- `POST /super-admin/subscriptions/:id/approve`
- `POST /super-admin/subscriptions/:id/reject`

**Users & Banning:**
- `GET /super-admin/users`
- `GET /super-admin/customers/banned`
- `POST /super-admin/customers/:id/ban`
- `DELETE /super-admin/customers/:id/ban`
- `GET /super-admin/bar-bans`

**Audit Logs:**
- `GET /super-admin/audit-logs`

---

## 📊 Key Features Explained

### Payment & Payout System
- Monitor all customer transactions (orders, reservations, subscriptions)
- Track payment status (pending, paid, failed, refunded)
- Process bar owner payouts with reference numbers
- Bulk payout processing for efficiency
- View platform fee earnings (5% default)

### Bar Management
- Approve or reject new bar registrations
- Suspend bars for violations
- Reactivate suspended bars
- View bar details, owner information, and financials
- Manage multi-branch operations

### Subscription Management
- View and manage subscription plans
- Approve or reject subscription requests
- Set subscription start dates
- Monitor active subscriptions by plan
- View subscription revenue

### Customer Banning
- **Global Bans:** Prevent customer access to entire platform
- **Per-Bar Bans:** Bar-specific customer restrictions
- Override bar bans as Super Admin
- View ban history and reasons

### Audit Logs
- Track all Super Admin actions
- Filter by action type, entity, date range
- View detailed action information
- Export logs for compliance

---

## 🎨 UI/UX Features

- **Responsive Design** - Works on desktop and tablets
- **Modern Interface** - Clean, professional Tailwind CSS styling
- **Status Badges** - Color-coded status indicators
- **Search & Filters** - Easy data filtering on all pages
- **Real-time Notifications** - Toast notifications for actions
- **Loading States** - Proper loading indicators
- **Error Handling** - User-friendly error messages

---

## 🔧 Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

---

## 🚀 Production Deployment

### Build the application:
```bash
npm run build
```

The build output will be in the `dist/` directory.

### Deployment Options:
- **Vercel** - Recommended for React apps
- **Netlify** - Easy deployment with CI/CD
- **AWS S3 + CloudFront** - For enterprise scale
- **Self-hosted** - Using Nginx or Apache

---

## 🔒 Security Considerations

- JWT tokens stored in localStorage
- All routes protected with authentication checks
- Role-based access control (SUPER_ADMIN only)
- HTTPS required in production
- API requests include CORS configuration
- Audit logging for all actions

---

## 📝 Development Notes

### Tailwind CSS Warnings
The `@tailwind` and `@apply` warnings in `index.css` are expected and processed correctly by PostCSS. These can be safely ignored.

### State Management
- Authentication state managed by Zustand with persistence
- API responses cached where appropriate
- Form state managed by React Hook Form

### Code Style
- Functional components with hooks
- Consistent file naming (PascalCase for components)
- Utility functions in `utils/` directory
- API calls centralized in page components

---

## 🤝 Backend Connection

This application requires the backend API from the `thesis-backend` folder to be running:

1. Navigate to backend directory: `cd thesis-backend`
2. Install dependencies: `npm install`
3. Start backend server: `npm start` (runs on port 3000)
4. Ensure MySQL database is running with the `tpg` database

---

## 📚 Related Documentation

- Context files in root directory explain system architecture
- Backend API documentation in `thesis-backend/` folder
- Database schema in SQL dump files

---

## ✅ Implementation Status

**Completed:**
- ✅ Authentication system
- ✅ Dashboard with metrics
- ✅ Revenue analytics
- ✅ Payment monitoring
- ✅ Payout processing
- ✅ Bar management
- ✅ Subscription management
- ✅ User directory
- ✅ Customer banning
- ✅ Platform feedback moderation
- ✅ Social moderation
- ✅ Registration management
- ✅ Permit monitoring
- ✅ System settings
- ✅ Audit logs

---

## 📞 Support

For issues or questions, refer to the context documentation files or backend implementation details.

---

**Last Updated:** April 5, 2026  
**Version:** 1.0.0  
**Status:** Production Ready
