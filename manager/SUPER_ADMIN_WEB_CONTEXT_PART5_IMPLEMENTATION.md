# SUPER ADMIN WEB - IMPLEMENTATION GUIDE & TECH STACK

**Last Updated:** March 18, 2026  
**Database:** `tpg`

---

## 🏗️ TECHNICAL ARCHITECTURE

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPER ADMIN WEB APP                       │
│                  (React + Vite Frontend)                     │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ HTTPS/REST API
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                   EXISTING BACKEND API                       │
│              (Node.js + Express + MySQL)                     │
│                                                              │
│  Routes:                                                     │
│  • /super-admin/*                                           │
│  • /super-admin-payments/*                                  │
│  • Authentication & RBAC Middleware                         │
└─────────────────────────────┬───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                      MYSQL DATABASE                          │
│                         (tpg)                                │
│                                                              │
│  Tables: bars, users, subscriptions, payment_transactions,  │
│  payouts, audit_logs, platform_audit_logs, etc.            │
└──────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│                  PAYMONGO API INTEGRATION                    │
│              (Payment Processing & Payouts)                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ TECHNOLOGY STACK

### Frontend (NEW - To Be Built)

**Framework:**
- **React 18+** with Hooks
- **Vite** for fast development and building

**State Management:**
- **Zustand** (lightweight, same as Bar Manager)
- Consider React Query for server state management

**Routing:**
- **React Router v6**

**UI Components:**
- **Tailwind CSS** for styling
- **shadcn/ui** for component library
- **Lucide React** for icons
- **Recharts** for charts and graphs
- **React Table** for data tables

**Form Handling:**
- **React Hook Form** + **Zod** for validation

**HTTP Client:**
- **Axios** for API requests

**Date Handling:**
- **date-fns** or **Day.js**

**Additional Libraries:**
- **react-hot-toast** for notifications
- **clsx** for conditional classes
- **react-helmet** for meta tags

### Backend (EXISTING)

**Runtime:**
- **Node.js 18+**

**Framework:**
- **Express.js**

**Database:**
- **MySQL 8.0+**
- **mysql2** driver with promise support

**Authentication:**
- **JWT** (jsonwebtoken)
- **bcrypt** for password hashing

**Payment Integration:**
- **PayMongo API** (via REST)

**File Storage:**
- Local file system (consider cloud storage for production)

**Logging:**
- Console logging (consider Winston for production)

---

## 📁 RECOMMENDED FRONTEND PROJECT STRUCTURE

```
super-admin-web/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/
│   │   ├── images/
│   │   └── icons/
│   ├── components/
│   │   ├── ui/                    # shadcn/ui components
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── Layout.jsx
│   │   │   └── Footer.jsx
│   │   ├── charts/
│   │   │   ├── RevenueChart.jsx
│   │   │   ├── BarGrowthChart.jsx
│   │   │   └── TransactionChart.jsx
│   │   └── common/
│   │       ├── DataTable.jsx
│   │       ├── SearchBar.jsx
│   │       ├── FilterBar.jsx
│   │       ├── Pagination.jsx
│   │       └── StatusBadge.jsx
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── BarManagement/
│   │   │   ├── BarList.jsx
│   │   │   ├── BarDetails.jsx
│   │   │   ├── BarApprovals.jsx
│   │   │   └── BranchManagement.jsx
│   │   ├── Payments/
│   │   │   ├── PaymentDashboard.jsx
│   │   │   ├── Transactions.jsx
│   │   │   ├── Payouts.jsx
│   │   │   └── PaymentSettings.jsx
│   │   ├── Subscriptions/
│   │   │   ├── SubscriptionPlans.jsx
│   │   │   ├── SubscriptionList.jsx
│   │   │   ├── SubscriptionApprovals.jsx
│   │   │   └── CreatePlan.jsx
│   │   ├── Users/
│   │   │   ├── UserList.jsx
│   │   │   ├── UserDetails.jsx
│   │   │   ├── BarOwners.jsx
│   │   │   └── Customers.jsx
│   │   ├── Banning/
│   │   │   ├── GlobalBans.jsx
│   │   │   └── PerBarBans.jsx
│   │   ├── RBAC/
│   │   │   ├── Roles.jsx
│   │   │   └── Permissions.jsx
│   │   ├── AuditLogs/
│   │   │   ├── PlatformLogs.jsx
│   │   │   └── BarActivityLogs.jsx
│   │   ├── Monitoring/
│   │   │   ├── Reviews.jsx
│   │   │   ├── Events.jsx
│   │   │   ├── Orders.jsx
│   │   │   └── Reservations.jsx
│   │   ├── Documents/
│   │   │   ├── DocumentVerification.jsx
│   │   │   └── AIVerifications.jsx
│   │   ├── Reports/
│   │   │   ├── FinancialReports.jsx
│   │   │   ├── OperationalReports.jsx
│   │   │   └── ComplianceReports.jsx
│   │   ├── Settings/
│   │   │   ├── SystemSettings.jsx
│   │   │   └── Profile.jsx
│   │   └── Auth/
│   │       └── Login.jsx
│   ├── api/
│   │   ├── axios.js                # Axios instance config
│   │   ├── barApi.js
│   │   ├── paymentApi.js
│   │   ├── subscriptionApi.js
│   │   ├── userApi.js
│   │   ├── auditLogApi.js
│   │   └── settingsApi.js
│   ├── stores/
│   │   ├── authStore.js            # Zustand store for auth
│   │   ├── dashboardStore.js
│   │   └── uiStore.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useDebounce.js
│   │   └── usePagination.js
│   ├── utils/
│   │   ├── formatters.js           # Currency, date formatting
│   │   ├── validators.js
│   │   ├── constants.js
│   │   └── helpers.js
│   ├── styles/
│   │   └── globals.css
│   ├── App.jsx
│   └── main.jsx
├── .env
├── .env.example
├── .gitignore
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## 🎨 UI/UX DESIGN GUIDELINES

### Design Principles

**1. Data-Dense but Scannable**
- Use tables with proper spacing
- Highlight important metrics with color
- Use status badges for quick identification
- Implement smart filtering and search

**2. Action-Oriented**
- Quick action buttons in tables
- Bulk actions for efficiency
- Confirmation modals for destructive actions
- Clear success/error feedback

**3. Dashboard-First**
- Key metrics at the top
- Visual charts for trends
- Quick links to common tasks
- Real-time updates where possible

### Color Scheme

**Status Colors:**
```css
/* Success/Active */
--success: #10b981;     /* green-500 */
--success-bg: #d1fae5; /* green-100 */

/* Warning/Pending */
--warning: #f59e0b;     /* amber-500 */
--warning-bg: #fef3c7; /* amber-100 */

/* Error/Rejected */
--error: #ef4444;       /* red-500 */
--error-bg: #fee2e2;   /* red-100 */

/* Info/Processing */
--info: #3b82f6;        /* blue-500 */
--info-bg: #dbeafe;    /* blue-100 */

/* Neutral/Inactive */
--neutral: #6b7280;     /* gray-500 */
--neutral-bg: #f3f4f6; /* gray-100 */
```

### Component Examples

**Status Badge:**
```jsx
// components/common/StatusBadge.jsx
export const StatusBadge = ({ status }) => {
  const variants = {
    active: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    rejected: 'bg-red-100 text-red-800',
    suspended: 'bg-gray-100 text-gray-800',
  };
  
  return (
    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${variants[status]}`}>
      {status.toUpperCase()}
    </span>
  );
};
```

**Data Table with Actions:**
```jsx
// components/common/DataTable.jsx
export const DataTable = ({ columns, data, actions }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {col.label}
              </th>
            ))}
            {actions && <th className="px-6 py-3">Actions</th>}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
              {actions && (
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## 🔐 AUTHENTICATION & AUTHORIZATION

### Login Flow

1. User enters credentials on login page
2. Frontend sends POST to `/auth/login`
3. Backend validates credentials
4. Backend checks if user role is `SUPER_ADMIN`
5. Backend returns JWT token
6. Frontend stores token in localStorage/sessionStorage
7. Frontend redirects to dashboard

**Login API:**
```javascript
// api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Protected Routes

```jsx
// components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  if (user?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
};
```

---

## 📊 STATE MANAGEMENT PATTERN

### Zustand Store Example

```javascript
// stores/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      
      login: (user, token) => {
        localStorage.setItem('token', token);
        set({ user, token, isAuthenticated: true });
      },
      
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },
      
      updateUser: (userData) => {
        set((state) => ({ user: { ...state.user, ...userData } }));
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

```javascript
// stores/dashboardStore.js
import { create } from 'zustand';

export const useDashboardStore = create((set) => ({
  dashboardData: null,
  loading: false,
  error: null,
  
  fetchDashboard: async (api) => {
    set({ loading: true, error: null });
    try {
      const response = await api.get('/super-admin/dashboard/overview');
      set({ dashboardData: response.data.data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },
  
  clearDashboard: () => set({ dashboardData: null, error: null }),
}));
```

---

## 🚀 IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)

**Goals:**
- Set up project structure
- Implement authentication
- Create layout components
- Build dashboard skeleton

**Tasks:**
1. Initialize Vite + React project
2. Install dependencies (Tailwind, shadcn/ui, Zustand, React Router, Axios)
3. Set up Axios instance with interceptors
4. Create authentication flow (login page, protected routes)
5. Build main layout (sidebar, navbar, footer)
6. Implement Zustand auth store
7. Create dashboard page structure

**Deliverable:** Working authentication + empty dashboard layout

---

### Phase 2: Dashboard & Core Features (Week 3-4)

**Goals:**
- Build main dashboard with real data
- Implement bar management pages
- Create payment monitoring pages

**Tasks:**
1. **Dashboard Page:**
   - Fetch and display key metrics
   - Implement charts (revenue trend, bar growth)
   - Add quick action cards
   - Real-time updates (optional)

2. **Bar Management:**
   - Bar list with search/filter
   - Bar details page
   - Bar approval workflow
   - Branch management

3. **Payment Monitoring:**
   - Payment dashboard
   - Transaction list with filters
   - Transaction details
   - Payout management
   - Mark payouts as sent

**Deliverable:** Functional dashboard + bar management + payment monitoring

---

### Phase 3: Subscriptions & Users (Week 5)

**Goals:**
- Subscription plan management
- Subscription approvals
- User management

**Tasks:**
1. **Subscription Plans:**
   - List plans
   - Create/edit plan modal
   - Plan feature configuration

2. **Subscription Approvals:**
   - Pending subscription list
   - Approve/reject workflow
   - View subscription history

3. **User Management:**
   - User directory (all users)
   - User details page
   - Bar owner list
   - Customer list
   - User activity logs

**Deliverable:** Complete subscription & user management system

---

### Phase 4: Banning, RBAC & Audit (Week 6)

**Goals:**
- Customer banning system
- RBAC viewer
- Audit log viewer

**Tasks:**
1. **Customer Banning:**
   - Global ban list
   - Ban/unban customer
   - Per-bar ban viewer
   - Override bar bans

2. **RBAC:**
   - Role list with permissions
   - Permission directory
   - User permission viewer

3. **Audit Logs:**
   - Platform audit log viewer
   - Bar activity log viewer
   - Log filtering and search
   - Log export

**Deliverable:** Complete security & compliance features

---

### Phase 5: Monitoring & Reports (Week 7)

**Goals:**
- Content monitoring (reviews, events)
- Document verification
- Reports generation

**Tasks:**
1. **Content Monitoring:**
   - Review list with flagging
   - Event list with moderation
   - Order monitoring
   - Reservation monitoring

2. **Document Verification:**
   - Pending documents queue
   - Document viewer
   - Verify/reject workflow
   - AI verification queue

3. **Reports:**
   - Financial reports
   - Operational reports
   - Compliance reports
   - Export functionality (CSV/PDF)

**Deliverable:** Complete monitoring & reporting system

---

### Phase 6: Settings & Polish (Week 8)

**Goals:**
- System settings
- Notifications
- UI polish
- Testing

**Tasks:**
1. **System Settings:**
   - Platform fee configuration
   - PayMongo settings
   - Feature flags
   - Email/SMS templates

2. **Notifications:**
   - Broadcast notification system
   - Notification history

3. **Polish:**
   - Loading states
   - Error handling
   - Empty states
   - Responsive design
   - Accessibility improvements
   - Performance optimization

4. **Testing:**
   - Unit tests for critical functions
   - Integration tests for workflows
   - E2E tests for main flows

**Deliverable:** Production-ready Super Admin Web App

---

## 📝 DEVELOPMENT BEST PRACTICES

### Code Quality

1. **Use TypeScript (Recommended):**
   - Type safety for API responses
   - Better IDE support
   - Fewer runtime errors

2. **Component Structure:**
   - Small, focused components
   - Reusable UI components
   - Custom hooks for logic

3. **API Layer:**
   - Separate API calls from components
   - Centralized error handling
   - Request/response interceptors

4. **State Management:**
   - Use Zustand for global state
   - React Query for server state
   - Local state for UI-only state

### Performance

1. **Code Splitting:**
   - Lazy load routes
   - Dynamic imports for heavy components

2. **Optimization:**
   - Memoize expensive computations
   - Virtualize long lists
   - Debounce search inputs
   - Optimize images

3. **Caching:**
   - Cache API responses (React Query)
   - Local storage for user preferences

### Security

1. **Token Management:**
   - Store JWT securely
   - Implement token refresh
   - Auto-logout on expiry

2. **Input Validation:**
   - Client-side validation with Zod
   - Sanitize user input
   - Prevent XSS attacks

3. **HTTPS Only:**
   - Use HTTPS in production
   - Secure cookies

### Testing

1. **Unit Tests:**
   - Test utility functions
   - Test custom hooks
   - Test API functions

2. **Component Tests:**
   - Test component rendering
   - Test user interactions
   - Test conditional rendering

3. **E2E Tests:**
   - Test critical workflows
   - Test approval processes
   - Test payment flows

---

## 🌐 DEPLOYMENT GUIDE

### Environment Variables

```env
# .env.production
VITE_API_BASE_URL=https://api.yourplatform.com
VITE_APP_NAME=Super Admin Portal
VITE_ENVIRONMENT=production
```

### Build Process

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview build
npm run preview
```

### Hosting Options

**Option 1: Vercel (Recommended)**
- Zero config deployment
- Automatic HTTPS
- CDN for static assets
- Easy rollbacks

**Option 2: Netlify**
- Similar to Vercel
- Good CI/CD integration

**Option 3: AWS S3 + CloudFront**
- More control
- Cost-effective for large scale
- Requires more setup

**Option 4: Self-hosted (VPS)**
- Full control
- Requires server management
- Use Nginx as reverse proxy

### Backend Considerations

**Security:**
- Rate limiting on sensitive endpoints
- CORS configuration
- Input validation
- SQL injection prevention

**Performance:**
- Database indexing (already done)
- Query optimization
- Response caching
- Connection pooling

**Monitoring:**
- Error logging (Winston + Sentry)
- Performance monitoring
- Uptime monitoring
- Database monitoring

---

## 📦 PACKAGE.JSON EXAMPLE

```json
{
  "name": "super-admin-web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest",
    "lint": "eslint src --ext js,jsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.24.0",
    "axios": "^1.6.7",
    "date-fns": "^3.3.1",
    "react-hook-form": "^7.50.1",
    "zod": "^3.22.4",
    "@hookform/resolvers": "^3.3.4",
    "recharts": "^2.12.0",
    "lucide-react": "^0.344.0",
    "react-hot-toast": "^2.4.1",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.0",
    "tailwindcss": "^3.4.1",
    "postcss": "^8.4.35",
    "autoprefixer": "^10.4.17",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "vitest": "^1.2.2"
  }
}
```

---

## 🔧 COMMON UTILITIES

### Currency Formatter

```javascript
// utils/formatters.js
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(amount);
};

// Usage: formatCurrency(1234.56) => ₱1,234.56
```

### Date Formatter

```javascript
import { format } from 'date-fns';

export const formatDate = (date) => {
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date) => {
  return format(new Date(date), 'MMM dd, yyyy hh:mm a');
};
```

### Status Helpers

```javascript
// utils/helpers.js
export const getStatusColor = (status) => {
  const colors = {
    active: 'green',
    pending: 'amber',
    rejected: 'red',
    suspended: 'gray',
    approved: 'green',
    completed: 'green',
    failed: 'red',
    processing: 'blue',
  };
  return colors[status] || 'gray';
};

export const getPaymentStatusText = (status) => {
  const texts = {
    pending: 'Pending',
    processing: 'Processing',
    paid: 'Paid',
    failed: 'Failed',
    refunded: 'Refunded',
    expired: 'Expired',
  };
  return texts[status] || status;
};
```

---

## 🎯 SUCCESS METRICS

### Key Performance Indicators

**User Efficiency:**
- Time to approve a bar: < 2 minutes
- Time to process payout: < 1 minute
- Time to find specific transaction: < 30 seconds

**System Health:**
- Page load time: < 2 seconds
- API response time: < 500ms
- Uptime: 99.9%

**User Satisfaction:**
- Easy navigation
- Clear action feedback
- Minimal errors
- Fast data loading

---

**END OF PART 5: IMPLEMENTATION GUIDE**

See SUPER_ADMIN_WEB_CONTEXT_COMPLETE.md for full consolidated document.
