# WorkPulse — Employee Management System

WorkPulse is a full-stack HR and workforce management system for a single company. It covers employee records, shift attendance (clock-in/out), leave requests, lateness penalties, payroll and payslips, announcements, notifications, and an audit trail of admin activity.

It has two roles:

| Role | What they can do |
|------|------------------|
| **Admin / Manager** | Manage employees (including bulk CSV upload), review and override attendance, approve or reject leave, run payroll and publish payslips, post announcements, view analytics and the activity log, and configure company settings, branding, work hours and penalties. |
| **Employee** | Clock in and out, view their attendance calendar and history, apply for leave, view and download payslips, see a live salary projection, and manage their profile. |

> There is no super-admin tier. Older accounts with a legacy `super_admin` role are treated as regular admins ([backend/utils/roles.js](backend/utils/roles.js)).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router 7, Vite, Tailwind CSS 4, Framer Motion, Recharts, lucide-react |
| PDF / export | jsPDF + jspdf-autotable, html2canvas, CSV export |
| Backend | Node.js (ES modules), Express 5, Mongoose 9 (MongoDB) |
| Auth | JWT (`jsonwebtoken`) in httpOnly cookies or request headers, passwords hashed with `bcryptjs` |
| Real-time | Socket.IO, used for notifications, leave updates and attendance events |
| Uploads | Multer, plus `sharp` for image processing; Cloudinary when configured, local disk otherwise |
| Tests | Node's built-in test runner, Jest + Supertest |

---

## Project structure

```
EMS-main/
├── server.js              # Main entry point: Express API + Socket.IO + Vite dev middleware on port 3000
├── api/index.js           # Serverless entry (e.g. Vercel). Re-exports backend/server.js
├── backend/
│   ├── server.js          # Standalone API server (serves client/dist), honours PORT
│   ├── config/mongodb.js  # Mongo connection with a 5s timeout and offline fallback
│   ├── routes/            # Express routers, one per domain
│   ├── controllers/       # Request handlers (attendance, payroll, leave, auth, ...)
│   ├── models/            # Mongoose schemas
│   ├── middleware/        # Auth guards (admin / employee), upload handlers
│   ├── services/          # Payroll engine, absence processor, storage (Cloudinary/local)
│   ├── utils/             # Work schedule, lateness tiers, audit logger, socket helpers
│   ├── scripts/           # Seeding and data-maintenance scripts
│   └── uploads/           # Local avatars and branding files (git-ignored, created at runtime)
├── client/
│   ├── vite.config.js     # Dev server on 5173, proxies /api, /uploads, /socket.io to :3000
│   └── src/
│       ├── routes/        # router.jsx, ProtectedRoute, OnboardingGate
│       ├── pages/Admin/   # Admin workspace (dashboard, employees, attendance, payroll, settings, ...)
│       ├── pages/Employees/ # Employee workspace
│       ├── pages/Auth/    # Admin and employee login / signup
│       ├── components/    # Shared widgets, charts, modals
│       ├── context/       # Auth, Branding, Theme, Attendance contexts
│       ├── services/      # API service wrappers
│       └── utils/         # PDF/CSV generators, work schedule, socket client
├── scripts/               # Root-level DB utilities (reset, purge, audit)
├── tests/                 # Test files
└── reports/               # Generated audit reports
```

---

## Getting started

### Prerequisites

- **Node.js 20+** (the code uses ES modules and top-level `await`)
- **MongoDB**: a local instance or a MongoDB Atlas cluster

### 1. Install dependencies

The repo is an npm workspace (`client` and `backend`), so a single install at the root covers everything:

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in real values:

```bash
cp .env.example .env
```

The server loads the root `.env` first, then `backend/.env` (without overriding values that are already set). The admin seed script reads **`backend/.env` only**, so if you plan to use it, put your variables there.

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGODB_URI` (or `MONGO_URI`) | Yes | MongoDB connection string. Either name works. |
| `JWT_SECRET` | Yes in production | Secret used to sign auth tokens. In development a fallback is generated if it is missing. Use a long random value. |
| `NODE_ENV` | No | `development` (default) or `production`. |
| `CLIENT_URL` / `FRONTEND_URL` | No | Public URL of the frontend. Defaults to `http://localhost:3000`. |
| `PORT` | No | Used by `backend/server.js` only. The root `server.js` always listens on **3000**. |
| `ADMIN_EMAIL`, `ADMIN_PSD` (or `ADMIN_PASSWORD`), `ADMIN_NAME` | For seeding | Credentials for `npm run seed:admin`. The password needs at least 8 characters. |
| `CLOUDINARY_URL` **or** `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | No | Enables Cloudinary for branding uploads. Without these, files are stored under `backend/uploads/`. |
| `ALLOW_OFFLINE_FALLBACK` | No | Lets `backend/server.js` start in production without a database connection. |
| `VITE_API_URL` | No (client) | Overrides the API base URL used by the frontend. |

> **Note:** `.env.example` lists `CLOUD_NAME`, `CLOUD_API_KEY` and `CLOUD_SECRET_KEY`, but the storage service reads the `CLOUDINARY_*` names above. Use the `CLOUDINARY_*` names if you want Cloudinary to work.

Never commit `.env` files. They are already in `.gitignore`.

### 3. Create the first admin

Pick one of these:

- **Through the UI:** start the app and open `/admin/auth?mode=signup`.
- **Through the seed script:** set `ADMIN_EMAIL` and `ADMIN_PSD` in `backend/.env`, then run:

  ```bash
  npm run seed:admin
  ```

### 4. Run the app

```bash
npm run dev
```

This starts the root [server.js](server.js), which serves the API, Socket.IO and the React app (through Vite middleware) together on **http://localhost:3000**.

For frontend work with hot reload, run the Vite dev server in a second terminal:

```bash
npm run dev --workspace=client   # http://localhost:5173, proxies API calls to :3000
```

### 5. Build for production

```bash
npm run build                 # builds client/dist
NODE_ENV=production npm start # serves the API and the built client on port 3000
```

---

## Application routes (frontend)

| Path | Page |
|------|------|
| `/` | Landing page |
| `/admin/auth` | Admin login / sign-up (`?mode=signup`) |
| `/employee/login` | Employee login |
| `/admin/dashboard` | Admin dashboard. Sub-pages: `employees`, `attendance`, `payroll`, `leave`, `announcements`, `activity`, `settings` |
| `/employee/dashboard` | Employee dashboard. Sub-pages: `attendance`, `payslips`, `leave`, `settings` |
| `/print-payslips/:id` | Printable payslip view |

Many legacy paths, such as `/admin/employees` and `/login/admin`, redirect to the routes above. See [client/src/routes/router.jsx](client/src/routes/router.jsx).

---

## API overview

All endpoints sit under `/api`. Several routers are also mounted under plural/singular aliases (for example `/api/employee` and `/api/employees`, or `/api/payroll` and `/api/payslips`) for backward compatibility.

| Base path | Router | Purpose |
|-----------|--------|---------|
| `/api/health` | — | Health check. Returns 200 when the database is connected and 503 otherwise. |
| `/api/auth` | [authRoutes.js](backend/routes/authRoutes.js) | Admin register/login/logout, employee login/logout, `GET /me`, `GET /admin/exists` |
| `/api/admin` | [adminRoutes.js](backend/routes/adminRoutes.js) | Admin operations: employees (CRUD, bulk upload/update/delete, CSV export), attendance management, payroll generate/publish, analytics, audit logs |
| `/api/employee(s)` | [employeeRoutes.js](backend/routes/employeeRoutes.js) | Employee self-service (profile, payslips, leave, salary projection) and the admin-side employee directory |
| `/api/attendance` | [attendanceRoutes.js](backend/routes/attendanceRoutes.js) | Clock in/out, today's status, monthly calendar, history, plus admin overrides, excuse/flag, manual records and biometric CSV upload |
| `/api/leave` | [leaveRoute.js](backend/routes/leaveRoute.js) | Apply for leave, view your leave history and stats, admin approve/reject |
| `/api/payroll` | [payrollRoutes.js](backend/routes/payrollRoutes.js) | Payroll summary, monthly run, live salary projection, forecasting, penalty analytics, payslips, export |
| `/api/dashboard` | [dashboardRoutes.js](backend/routes/dashboardRoutes.js) | Admin and employee dashboard data, recent activity, late-attendance alerts |
| `/api/settings` | [adminSettingsRoute.js](backend/routes/adminSettingsRoute.js) | Company, employee, payroll, leave, attendance, penalty and security settings |
| `/api/announcements` | [announcementRoutes.js](backend/routes/announcementRoutes.js) | Create, edit, pin and delete announcements |
| `/api/notifications` | [notificationRoutes.js](backend/routes/notificationRoutes.js) | List notifications, mark read/unread, dismiss, clear |
| `/api/company` | [companyRoutes.js](backend/routes/companyRoutes.js) | Company profile and public branding (logo, name) |
| `/api/setup` | [setupRoutes.js](backend/routes/setupRoutes.js) | System initialisation status |
| `/api/users` | [userRoutes.js](backend/routes/userRoutes.js) | Profile picture removal |

**Authentication:** a successful login sets an httpOnly `auth_token` cookie that is valid for 7 days, or 30 days with "remember me". The API also accepts the token from the `Authorization: Bearer` header and from the `x-admin-token` / `x-employee-token` headers. Admin routes are protected by [authAdmin.js](backend/middleware/authAdmin.js) and employee routes by [employeeAuth.js](backend/middleware/employeeAuth.js).

**Database guard:** when MongoDB is unreachable, `/api` requests return `503` with `code: "DATABASE_DISCONNECTED"` instead of hanging.

---

## Core business rules

### Work schedule

- The default schedule is **08:00 – 19:00, Monday to Saturday**. Admins can change it under **Settings → Attendance**.
- **Sunday is always a rest day**, regardless of settings.
- Times use the **server's local time zone**. No time zone is stored anywhere.
- Source: [backend/utils/workSchedule.js](backend/utils/workSchedule.js)

### Attendance

- Employees clock in and out from their dashboard.
- **Auto-close:** open shifts are closed automatically at **19:30**, and shifts left open from earlier days are closed too. This sweep runs at startup and then every 60 seconds.
- **Automatic absences:** once a working day's closing time passes, every active employee with no attendance record and no approved leave for that day gets an `Absent` record. Running it again never creates duplicates. ([absenceProcessor.js](backend/services/absenceProcessor.js))
- Admins can override, excuse, flag or recalculate records, add manual records, or bulk-upload biometric attendance from a CSV file.

### Lateness penalties

Default fines by tier. Admins can change the amounts under **Settings → Penalties**.

| Tier | Minutes late | Default fine |
|------|--------------|--------------|
| 1 | 1 – 30 | 10 |
| 2 | 31 – 60 | 30 |
| 3 | 61 – 120 | 50 |
| 4 | 121 – 180 | 75 |
| 5 | 181 – 240 | 100 |
| 6 | 241+ | 150 |

Source: [backend/utils/latenessPenaltyCalculator.js](backend/utils/latenessPenaltyCalculator.js)

### Payroll

For each employee and month ([payrollCalculationService.js](backend/services/payrollCalculationService.js)):

```
daily rate          = base salary ÷ working days in the month
absence deductions  = unexcused absent days × daily rate
lateness deductions = sum of the tier fines for the month
net pay             = base salary + allowances − absence deductions − lateness deductions − other deductions
                      (never below 0)
```

- Days that haven't happened yet are never counted as absent, and approved leave days are not deducted.
- The default currency is **GHS (₵)**, configurable in company settings.
- Admins generate a monthly payroll run, review it, and **publish** it. Published payslips appear in the employee portal and can be downloaded as PDF.

### Leave

Employees submit leave requests. Admins approve or reject them, and a request's status is `Pending`, `Approved` or `Rejected`. Approved leave counts as covered for both absence detection and payroll. Status changes reach the employee in real time through Socket.IO.

---

## npm scripts

Run these from the repository root.

| Script | What it does |
|--------|--------------|
| `npm run dev` / `npm start` | Starts the combined server on port 3000 |
| `npm run build` | Builds the React client into `client/dist` |
| `npm run lint` | Runs ESLint on the client |
| `npm run seed:admin` | Creates or updates the admin from `ADMIN_EMAIL` / `ADMIN_PSD` |
| `npm run seed` | Seeds sample data ([backend/scripts/seedRealData.js](backend/scripts/seedRealData.js)) |
| `npm test` | Runs the tenant isolation tests with `node --test` |
| `npm run test:jest` | Runs the Jest cross-company isolation suite |
| `npm run db:reset` | ⚠️ **Wipes** users, admins, employees and company settings so the app starts fresh |
| `npm run db:purge-test-seeds` | Removes mock/test companies |
| `npm run db:normalize-attendance-dates` | Normalises stored attendance dates |
| `npm run db:remove-seeded-reviews` | Removes seeded performance reviews |
| `npm run audit:aggregations` / `audit:tenant-models` | Developer audit reports |

---

## Deployment notes

- **Single server (recommended):** run `npm run build`, then `NODE_ENV=production npm start`. One Node process serves the API, WebSockets and the static frontend on port 3000.
- **Serverless:** [api/index.js](api/index.js) exports the Express app from [backend/server.js](backend/server.js) for platforms such as Vercel. Socket.IO real-time features and the local `backend/uploads` folder won't persist in a serverless environment, so configure Cloudinary for uploads.
- In production, set `JWT_SECRET` and `MONGODB_URI`. Without a database connection, `backend/server.js` refuses to start unless `ALLOW_OFFLINE_FALLBACK` is set.

---

## Architecture notes

- **Single-tenant:** the tenant middleware ([tenantMiddleware.js](backend/middleware/tenantMiddleware.js)) passes every request through unchanged. One deployment serves one company.
- **Two server entry points:** the root [server.js](server.js) is used for local development and single-server hosting, while [backend/server.js](backend/server.js) backs the serverless entry. Keep route mounts in sync when you add a router.
- **Activity / audit log:** admin actions are recorded via [auditLogger.js](backend/utils/auditLogger.js) and shown on the Activity page.
- **Branding:** the company name, logo and colours come from company settings and are loaded on the client through `BrandingContext`.
