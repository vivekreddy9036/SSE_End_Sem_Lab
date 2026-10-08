<div align="center">

<img src="./public/coats_login.png" alt="CoATS" width="400" />

<br/>

# CoATS V2
### Complaint Administration & Tracking System

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

<br/>

> A secure, modern platform for law enforcement to register, manage, and track criminal complaints across branches.

</div>

---

## What is CoATS?

CoATS replaces manual, paper-based case tracking in law enforcement departments with a fast and auditable digital system. Officers manage their own branch cases while supervisors get a birds-eye view across all branches — all behind strong multi-factor authentication.

---

## Features

- **Case Management** — Register complaints, track stages, log progress, and manage action items
- **Role-Based Access** — Officers see their branch; supervisors see everything
- **Analytics Dashboard** — Visual charts showing case distribution by stage and branch
- **Multi-Factor Auth** — Password + TOTP (Google Authenticator) or Passkey (Face ID / fingerprint)
- **Audit Trail** — Every login and security event is logged with timestamp and IP

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
NEXT_PUBLIC_APP_NAME="CoATS"
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

Next.js 16 · React 19 · TypeScript · Tailwind CSS · Prisma · PostgreSQL · shadcn/ui · Recharts · WebAuthn · TOTP · JWT

---

## License

MIT — see [LICENSE](./LICENSE) for details.

<br/>

<div align="center">
<img src="./public/coats_icon_header.png" alt="CoATS" width="48" />
<br/>
<sub>CoATS V2 — Built with precision, secured by design.</sub>
</div>
