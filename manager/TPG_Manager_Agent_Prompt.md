# 🤖 AGENT TASK — The Party Goers: Manager Website Context + Flutter Prompt Generator

## YOUR JOB

You are a senior full-stack developer and technical writer. I need you to do **two things in one output**:

1. **Analyze my entire manager website codebase** (frontend + backend) and produce a detailed context document — exactly like a codebase analysis doc.
2. **At the end of that context document**, append a complete Flutter/Dart agent prompt so another AI agent can implement the manager app in Flutter using what you documented.

Output everything as **one single Markdown file** ready to save as `MANAGER_APP_CONTEXT.md`.

---

## PART 1 — CONTEXT DOCUMENT

Analyze the full manager website codebase and produce a document with these exact sections:

### 1. PROJECT OVERVIEW
- Platform name, purpose, and who uses it (bar manager/owner role)
- What the manager can do (manage bar info, tables, events, menu, reservations, staff, payroll, analytics, POS, inventory, etc.)
- Tech stack: frontend framework, HTTP client, state management, map library, auth method
- Backend: framework, database, auth method, payment provider, file uploads
- Deployment ports / environment config

### 2. DIRECTORY STRUCTURE
- Full annotated folder tree for both frontend and backend
- One-line description per file explaining what it does

### 3. ALL VIEWS / PAGES
For every page/view in the manager frontend, document:
- View name and route/path
- Purpose and what the manager sees
- All major UI sections and components on the page
- All API calls made (method + endpoint + params + what data is returned)
- All state variables managed
- Business rules and validations enforced

### 4. ALL API ENDPOINTS USED (FRONTEND → BACKEND)
For every API call the frontend makes:
- HTTP method + full endpoint path
- Request body / query params
- Response shape
- Which view/component uses it
- Auth required? (yes/no)

### 5. ALL BACKEND ROUTES
For every backend route file:
- Route prefix
- List every endpoint with: method, path, middleware (auth/role/permission), handler description
- Any special business logic (double-booking checks, fee calculations, inventory deductions, etc.)

### 6. DATABASE TABLES
For every table used by the manager:
- Table name
- All columns with types and purpose
- Relationships (foreign keys)
- Any important indexes or constraints

### 7. STATE MANAGEMENT
- How auth state is stored and shared across views
- How navigation works (router, SPA context, etc.)
- Any global stores (cart, notifications, etc.)
- Local/session storage usage

### 8. SECURITY & PERMISSIONS
- Auth flow (JWT, sessions, OAuth)
- Role-based access control (which roles can access manager features)
- Permission system (DB-driven RBAC if applicable)
- Any route guards or middleware

### 9. DESIGN SYSTEM
Document every reusable UI pattern:
- Color variables / CSS custom properties
- Card styles (glass, solid, bordered)
- Button variants (primary, ghost, danger, etc.)
- Input/form styles
- Badge and status chip styles
- Typography scale
- Layout system (grid, flex classes)
- Animation classes

### 10. BUSINESS RULES & CONVENTIONS
- All important business rules (reservation rules, payment rules, inventory rules, payroll rules, etc.)
- Naming conventions (files, variables, API responses)
- Date/time handling (timezone, formatting)
- Currency formatting
- Error handling patterns
- Image/file upload handling

---

## PART 2 — FLUTTER/DART IMPLEMENTATION PROMPT

After completing the context document above, append this section at the very end of the same Markdown file, titled:

```
---
# 🎯 FLUTTER/DART IMPLEMENTATION PROMPT — The Party Goers Manager App
```

In this section, write a complete Flutter agent prompt using everything documented in Part 1. The Flutter prompt must include:

### DESIGN SYSTEM (HARD REQUIREMENT — DO NOT CHANGE)
The manager app must use the **exact same theme** as the customer app:
- **Background:** `#0A0A0A` (near-black)
- **Surface/Cards:** `#111111` to `#1A1A1A` (dark glassmorphism cards with `BackdropFilter` blur)
- **Primary Accent:** `#CC0000` / `#E8001E` (red — buttons, highlights, labels, active nav)
- **Text Primary:** `#FFFFFF`
- **Text Secondary/Muted:** `#888888` / `#666666`
- **Borders:** `rgba(255,255,255,0.08)`
- **NO white or light backgrounds anywhere in the app**
- **Logo:** "THE PARTY" white bold + "GOERS" red bold (split color)
- **Section Labels:** Small uppercase red tracking-wide labels above white+red title combos
- **Buttons:** Red filled (primary CTA), dark outlined ghost (secondary), dark glass (tertiary)
- **Badges/Chips:** Red, green (active/open), amber (pending/warn), dark glass (neutral)
- **Status colors:** paid=green, pending=amber, cancelled=dim gray, failed=red, approved=green

### Reusable Widgets to Build
- `GlassCard` — dark translucent card, subtle border, blur, 12–16px radius
- `RedButton` — filled red CTA button
- `GhostButton` — outlined dark button with optional icon
- `GlassInput` / `GlassDropdown` / `GlassTextArea` — dark translucent form controls
- `BadgeChip` — red/green/amber/glass rounded status chip
- `StatCard` — large bold number + small uppercase label on dark card
- `SectionHeader` — red small-caps label + bold white+red title
- `StatusTag` — reservation/payment/inventory status with correct color

### Navigation
- Bottom navigation bar (mobile) or side rail with manager sections
- Dark AppBar: logo left, notification bell with badge, manager name + avatar right
- All navigation in dark theme — no white nav bars

### All Screens
Based on the codebase analysis above, generate full screen specs for EVERY manager view including:
- Screen name and purpose
- All UI sections and widgets
- All API calls with exact endpoints, request params, response handling
- Loading states (shimmer placeholders, dark background)
- Error states (dark error cards, red error text)
- Empty states (dark empty state with icon + message)
- All forms with validation rules
- All modals/bottom sheets
- All business rule enforcements in the UI

### Auth Flow
- JWT stored in `flutter_secure_storage`
- `Dio` HTTP client with Bearer token interceptor
- 401 → clear token → redirect to Login
- Only users with manager/owner role can access — block all other roles with an error screen
- Maintenance mode: show full-screen overlay if API returns maintenance flag

### Recommended Packages
List all Flutter packages needed based on the features discovered in the codebase (maps, charts, camera for uploads, file picker, PDF generation if payroll/reports exist, etc.) plus these base packages:
```yaml
dio: ^5.4.0
flutter_secure_storage: ^9.0.0
shared_preferences: ^2.2.2
provider: ^6.1.2
go_router: ^13.2.0
cached_network_image: ^3.3.1
intl: ^0.19.0
shimmer: ^3.0.0
lottie: ^3.1.0
flutter_svg: ^2.0.10+1
url_launcher: ^6.2.5
image_picker: ^1.1.2
```

### Folder Structure
Produce a clean `lib/` folder structure following this architecture:
```
lib/
├── main.dart
├── core/           # theme, constants, router
├── data/
│   ├── api/        # one file per API module
│   └── models/     # one Dart model per DB table
├── providers/      # auth, cart, any global state
├── screens/        # one file per screen
├── widgets/        # all reusable widgets
└── utils/          # date, currency, distance, image helpers
```

### Critical Implementation Rules
1. Philippine Peso ₱ — format as `₱1,234.00` using `NumberFormat.currency(locale: 'en_PH', symbol: '₱')`
2. All dates in **Asia/Manila (UTC+8)** timezone
3. All images via `cached_network_image` with dark placeholder fallbacks (no white placeholders)
4. Error messages extracted from `e.response.data.message` via Dio interceptor
5. Loading states always use `shimmer` with dark base color `#1A1A1A`
6. All monetary calculations match backend precision (use `double`, display with `.toStringAsFixed(2)`)
7. Role enforcement: check `user.role` on login — block non-manager/owner roles immediately
8. Maintenance mode check on every app launch and auth call
9. Image uploads use `image_picker` + `dio` multipart form data
10. All lists support pull-to-refresh and infinite scroll pagination

---

## HOW TO DELIVER

Output the entire result as **one continuous Markdown document** structured as:

```
# THE PARTY GOERS — Manager Website Application Context
[... Part 1: all 10 context sections ...]

---
# 🎯 FLUTTER/DART IMPLEMENTATION PROMPT — The Party Goers Manager App
[... Part 2: complete Flutter agent prompt ...]
```

Be exhaustive. Do not summarize or skip endpoints, tables, or screens. Every detail documented will be used directly by a Flutter developer agent to build the app.
