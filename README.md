# Hospital Management System

Next.js + Prisma hospital management system.

## Requirements

- Node.js 22.x
- PostgreSQL database (Supabase or compatible)
- npm

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your environment file:

   ```bash
   copy .env.example .env
   ```

3. Fill in the required values in `.env`, especially:

   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `APP_BASE_URL`
   - `NEXT_PUBLIC_APP_URL`

4. Generate Prisma client:

   ```bash
   npx prisma generate
   ```

## Run locally

```bash
npm run dev
```

If Prisma or dependencies are out of sync, use:

```bash
npm run setup
```

## Build

```bash
npm run build
npm run start
```

## Notes

- The app will not run without a valid database connection and environment variables.
- `npm run dev` triggers a Prisma check before starting.
