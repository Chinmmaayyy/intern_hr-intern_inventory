# Startup Guide

Step-by-step: start the app after setting up `.env`.

## 1. Open the project folder

Make sure your terminal is in the repository root.

```bash
cd intern_hr-intern_inventory_clean
```

## 2. Verify `.env`

Confirm `.env` exists and has the required values filled in from `.env.example`.

Required values include:

- `DATABASE_URL`
- `DIRECT_URL`
- `JWT_SECRET`
- `APP_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

## 3. Install dependencies

Run:

```bash
npm install
```

## 4. Generate Prisma client

Run:

```bash
npx prisma generate
```

## 5. Start the app

Run:

```bash
npm run dev
```

The app should start in development mode.

## 6. If the database is new

If the database has no schema yet, run the database setup command your project uses before starting the app.

Common options are:

```bash
npx prisma migrate dev
```

or:

```bash
npx prisma db push
```

Use the one that matches your workflow.

## 7. Open the app

After the server starts, open the local URL shown in the terminal, usually:

```bash
http://localhost:3000
```
