# videospots

Multi-user web app for scheduling video campaigns (game trailers, promo spots) on retail in-store displays across Central Europe. Everything revolves around **Sony PlayStation** titles.

Screens are **not** online — this is a planning/orientation tool, not a playout system. The planning unit is a **(Country × Chain) virtual channel**: e.g. "Datart in CZ", "MediaMarkt in PL". All screens of one chain in one country play the same content, so we plan at that granularity and never per individual display.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind v4
- **Neon Postgres** (serverless) + **Drizzle ORM**
- **Auth.js v5** with email/password (Credentials provider, bcrypt, JWT sessions). No self-signup — admins create users in `/admin/users`.
- Game metadata entered manually in the campaign form (no external API). If the catalog grows, swap in [RAWG](https://rawg.io/apidocs) (single API key) or IGDB.
- Hosted on **Vercel**

## Setup

### 1. Prerequisites

- Node.js 20+ (`node --version` should print v20 or higher)
- A Neon Postgres database — sign up at [neon.tech](https://neon.tech)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env.local` and fill in the secrets:

```bash
cp .env.example .env.local
```

Then edit `.env.local`:

| Variable        | How to get it                                                                 |
|-----------------|-------------------------------------------------------------------------------|
| `DATABASE_URL`  | Neon → your project → Connection Details → "Pooled connection".               |
| `AUTH_SECRET`   | Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

### 4. Push the schema and seed initial data

```bash
npm run db:push    # creates tables in Neon
npm run db:seed    # inserts CZ/SK/HU/PL + 6 retail chains + channel matrix + admin user
```

The seed creates a default user **`admin` / `admin`** — change it immediately on first login (`/admin/users` → reset password) and add real teammates from there.

### 5. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with `admin` / `admin`.

## Useful commands

| Command            | What it does                                          |
|--------------------|-------------------------------------------------------|
| `npm run dev`      | Dev server (Turbopack)                                |
| `npm run build`    | Production build                                      |
| `npm run lint`     | ESLint                                                |
| `npm run db:push`  | Sync schema → Neon (no migration files; dev workflow) |
| `npm run db:generate` | Generate migration SQL into `./drizzle/`           |
| `npm run db:studio`| Drizzle Studio — local UI to browse/edit DB           |
| `npm run db:seed`  | Re-run seed (idempotent)                              |

## Project structure

```
videospots/
├── app/
│   ├── page.tsx                    # Dashboard — Gantt timeline of campaigns
│   ├── layout.tsx                  # Root layout + nav
│   ├── sign-in/                    # Magic-link sign-in
│   ├── admin/
│   │   ├── countries/              # CRUD + seed-style list
│   │   ├── chains/                 # CRUD
│   │   ├── channels/               # Country × Chain matrix
│   │   └── users/                  # Add team members, reset passwords
│   ├── campaigns/
│   │   ├── new/                    # Create form (manual game entry)
│   │   └── [id]/                   # Detail / delete / video preview
│   └── api/
│       └── auth/[...nextauth]/     # Auth.js handler
├── components/
│   ├── nav.tsx
│   └── timeline.tsx                # Gantt view
├── lib/
│   ├── db/
│   │   ├── schema.ts               # All tables + relations
│   │   ├── client.ts               # Neon HTTP + Drizzle instance
│   │   └── seed.ts
│   └── utils.ts
├── auth.ts                         # Full Auth.js (with DB adapter) — server only
├── auth.config.ts                  # Edge-safe slice (used by proxy.ts)
├── proxy.ts                        # Route-level auth gate (Next.js 16 convention)
└── drizzle.config.ts
```

## Data model

| Table              | Purpose                                                                  |
|--------------------|--------------------------------------------------------------------------|
| `country`          | Markets (CZ, SK, HU, PL…). Admin-editable.                               |
| `chain`            | Retail brands (Datart, Alza, MediaMarkt…). Admin-editable.               |
| `channel`          | (country × chain) tuple = a virtual broadcast channel.                   |
| `game`             | Game metadata (cover, summary, release date, platforms). Manually entered, deduped by case-insensitive name. |
| `campaign`         | Video spot scheduled for a date range.                                   |
| `campaign_channel` | Junction: which channels does this campaign target?                      |
| `audit_log`        | Who created / modified / deleted what (multi-user shared tool).          |
| `user`             | Login accounts (email/username + bcrypt password). Managed via `/admin/users`. |
| `account/session/verificationToken` | Auth.js standard tables — unused under the JWT/Credentials strategy, but kept so we can switch to OAuth/magic-link later without a migration. |

## Deploy to Vercel

1. Push to GitHub.
2. Import the repo into Vercel.
3. Add the same env vars (`DATABASE_URL`, `AUTH_SECRET`) in **Project Settings → Environment Variables**.
4. Deploy. Neon's HTTP driver works on Vercel's Edge runtime out of the box.

## Roadmap (next up)

- Campaign edit form (currently you can only delete + recreate).
- Conflict / overlap detection on the timeline (visual warning when two campaigns overlap on the same channel).
- "Day in the life" simulator — replay a channel's playlist as it would appear on screen.
- Map view of which countries are running which campaign right now.
- Sortable / draggable timeline bars to adjust campaign dates.
- Video upload to Vercel Blob (instead of just URL).
