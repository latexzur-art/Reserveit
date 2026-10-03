# ReserveIT

**ReserveIT** is a web-based Facility and Equipment Scheduling Management System built for **STI College Lucena**. It replaces manual logbooks with a centralized, role-aware booking platform — handling room reservations, equipment scheduling, class schedule management, and payment processing from a single interface.

---

## Features

- **Facility & Equipment Booking** — Reserve classrooms, labs, and equipment across STI Lucena's two campus buildings
- **Microsoft SSO** — Single Sign-On via Microsoft Azure AD, scoped to STI College Lucena accounts
- **Role-Based Access Control** — Distinct dashboards and permissions for each user role
- **Approval Workflow** — Multi-step booking lifecycle with status tracking (Pending → Approved / Rejected → Completed)
- **Payment Integration** — Online payment support via PayMongo for applicable reservations
- **Real-Time Availability** — Live slot visibility to prevent scheduling conflicts
- **Class Schedule Management** — Upload, validate, and manage academic class schedules with conflict detection
- **Booking History & Audit Logs** — Full audit trail for booking status changes with user/system attribution

---

## User Roles

| Role | Description |
|------|-------------|
| **Academic Head** | Reviews and approves/rejects booking requests, manages schedules |
| **Admin** | Manages facilities, equipment, buildings, users, and system settings |
| **Faculty** | Submits booking requests for classrooms and equipment |
| **Program Head** | Manages program-level schedules and curriculum planning |
| **External Client** | External users who can request facility rentals with payment |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Frontend | React 19, Tailwind CSS 4, Radix UI, Recharts |
| Backend | Next.js API Routes (Server-Side) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| Auth | Microsoft OAuth (Azure AD) via Supabase Auth |
| Payments | [PayMongo](https://www.paymongo.com/) API |
| Testing | Vitest (Unit), Playwright (E2E) |

---

## Getting Started

### Prerequisites

- Node.js v18+
- A [Supabase](https://supabase.com/) project with the ReserveIT schema applied
- Microsoft Azure AD app registration (for OAuth)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/reserveit.git
cd reserveit

# Install dependencies
npm install
```

### Environment Variables

Copy the example environment file and fill in the values:

```bash
cp .env.example .env.local
```

Key variables include:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PAYMONGO_SECRET_KEY=your_paymongo_secret
MICROSOFT_CLIENT_ID=your_azure_client_id
MICROSOFT_CLIENT_SECRET=your_azure_client_secret
MICROSOFT_TENANT_ID=your_azure_tenant_id
```

> Never commit `.env` files. Refer to `.env.example` for the full list of required variables.

### Running Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Database Migrations

```bash
# Link to your Supabase project
npm run db:link

# Push migrations
npm run db:migration:push
```

See [`QUICKSTART_MIGRATIONS.md`](./QUICKSTART_MIGRATIONS.md) for detailed setup instructions.

---

## Project Structure

```
reserveit/
├── app/                # Next.js App Router — pages, layouts, and API routes
│   ├── api/            # Server-side API route handlers
│   ├── academic/       # Academic Head dashboard pages
│   ├── admin/          # Admin dashboard pages
│   ├── faculty/        # Faculty dashboard pages
│   ├── program/        # Program Head dashboard pages
│   └── auth/           # Authentication flow pages
├── backend/            # Business logic, services, and domain handlers
├── components/         # Reusable UI components (shadcn/ui based)
├── contexts/           # React context providers
├── hooks/              # Custom React hooks (organized by role)
├── lib/                # Supabase clients, utilities, and helpers
├── services/           # Client-side service layer
├── supabase/           # Database migrations and Supabase config
│   └── migrations/     # SQL migration files (versioned)
├── types/              # Shared TypeScript type definitions
├── __tests__/          # Unit tests (Vitest)
├── e2e/                # End-to-end tests (Playwright)
├── scripts/            # Utility and maintenance scripts
├── public/             # Static assets
└── docs/               # Project documentation
```

---

## Testing

```bash
# Run unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui
```

---

## Development Team

Developed by a four-person team from **STI College Lucena** as a capstone/thesis project.
