<div align="center">

# SentinelIAM

### Identity & Access Management Platform

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

<br/>

> A simplified Identity and Access Management platform: registration, login, role assignment, permission management, password reset, access requests, access approval, and account deactivation — behind strong multi-factor authentication.

</div>

---

## What is SentinelIAM?

SentinelIAM lets administrators define who can do what: `User → Role → Permission → Resource`. Users register, authenticate with MFA, and request access to protected resources; designated approvers review those requests; every security-relevant action is written to an audit trail.

---

## Features

- **User Lifecycle** — Self-service registration, password reset, account deactivation/reactivation
- **Role-Based Access Control** — Administrators define Roles, Permissions, and the Resources they protect
- **Access Requests** — Users request access with a justification; approvers scoped to their own resources review it
- **Multi-Factor Auth** — Password + TOTP (Google Authenticator) or Passkey (Face ID / fingerprint)
- **Audit Trail** — Every login, role change, permission grant, and access decision is logged with timestamp and IP
- **Privilege-Escalation Guards** — Role assignment and access approval are re-verified server-side against live DB state, not just a cached JWT claim

---

## Getting Started

**Prerequisites:** Node.js ≥ 20, PostgreSQL database

```bash
# 1. Install dependencies
npm install

# 2. Set up your .env file (see below)

# 3. Push the database schema
npm run db:push

# 4. Seed sample data (optional)
npm run db:seed

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
DATABASE_URL="postgresql://..."
DIRECT_DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
WEBAUTHN_RP_ID="localhost"
WEBAUTHN_ORIGIN="http://localhost:3000"
TOTP_ENCRYPTION_KEY="your-32-byte-hex-key"
NEXT_PUBLIC_APP_NAME="SentinelIAM"
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | Reset database |

---

## Tech Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Prisma · PostgreSQL · shadcn/ui · WebAuthn · TOTP · JWT · Zod

---

## License

MIT — see [LICENSE](./LICENSE) for details.
