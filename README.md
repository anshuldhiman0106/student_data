# Student Data Dashboard

This repository is a Next.js application that displays student profiles stored in Supabase. The UI shows student photos with blurred details and provides a paid unlock flow (Razorpay) to reveal full details. Admin users can unlock student details for free via an admin panel.

**Core features**
- Photo-first student cards with blurred details
- OAuth-based authentication (Google / GitHub)
- Razorpay checkout for purchasing access to student details (₹10)
- Admin panel for bulk free-unlock of student records
- CSS variables-driven theme utilities in `app/globals.css`

**Important files**
- `app/supabase_student_dashboard.jsx` — main dashboard UI and auth/payment flow
- `app/api/create-order/route.js` — server API route that creates Razorpay orders
- `app/api/verify-payment/route.js` — server API route that verifies Razorpay signatures
- `app/globals.css` — CSS variables and utility classes (use `bg-<variable_name>`)

## Getting started (development)

1. Install dependencies:

```powershell
cd d:\scapper\student_data
npm install
```

2. Copy environment example and set your secrets:

- Create a `.env` file at the project root or edit the existing one.
- Required env variables (add real values):

  - `NEXT_PUBLIC_SUPABASE_URL` — e.g. `https://<project-ref>.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
  - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-only)
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` — Razorpay Key ID (test/production)
  - `RAZORPAY_KEY_ID` — same as above (used server-side)
  - `RAZORPAY_KEY_SECRET` — Razorpay Key Secret (server-only)
  - `NEXT_PUBLIC_ADMIN_EMAILS` — comma-separated admin emails (e.g. `a@x.com,b@y.com`)

3. Start the dev server:

```powershell
npm run dev
```

4. Open `http://localhost:3000` and navigate to the dashboard.

## Authentication

- The app uses Supabase Auth. The dashboard opens an OAuth sign-in flow (Google / GitHub) when users attempt to unlock student details.
- To use OAuth providers:
  - Enable the provider in the Supabase Dashboard → Authentication → Providers.
  - For Google/GitHub, create OAuth credentials in the provider console and add the Supabase callback redirect URI:
    - `https://<your-project-ref>.supabase.co/auth/v1/callback`
  - Optionally add `http://localhost:3000` to the OAuth app redirect URIs for local testing.

## Admins

- Admins are detected using the `NEXT_PUBLIC_ADMIN_EMAILS` env variable (comma-separated). When a signed-in user's email matches one of these, the UI shows an "Admin" badge and an "Admin Panel" button.
- Admins can:
  - Unlock individual student details for free directly on the card
  - Open the Admin Panel to bulk view/unlock selected students

Security note: Using a public env variable to mark admins is convenient for development but not secure for production. Recommended approaches:
- Add an `admins` table to Supabase and check admin membership server-side.
- Use custom JWT claims or Supabase RLS policies for robust access control.

## Payments: Razorpay integration

- The client creates an order by calling `POST /api/create-order` (server route).
- The server uses your `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to create an order via Razorpay REST API.
- The client opens the Razorpay checkout widget and on success the client posts the payment details to `POST /api/verify-payment` for signature verification.

Files involved:
- `app/api/create-order/route.js` — creates the order
- `app/api/verify-payment/route.js` — verifies HMAC-SHA256 signature using `RAZORPAY_KEY_SECRET`

Security note: Keep `RAZORPAY_KEY_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` only on the server; never expose them in client-side code or public envs.

## Database suggestions

If you want to persist which users unlocked which students, add a small table in Supabase, e.g.:

```sql
create table if not exists user_unlocks (
  id bigserial primary key,
  user_id uuid not null,
  student_id text not null,
  amount integer,
  payment_id text,
  created_at timestamptz default now()
);
```

On successful payment verification (server-side), insert a row into `user_unlocks` so users keep access across sessions.

## Styling and variables

- All design tokens (colors) are declared in `app/globals.css` as CSS variables (e.g. `--bg-main`, `--card-bg`).
- Utility classes were added to `globals.css` so components can use `bg-bg-main`, `bg-card-bg`, `text-text-main` etc.
- Use these utilities across components for consistent theming.

## Troubleshooting

- "Invalid supabaseUrl: Provided URL is malformed": Ensure `NEXT_PUBLIC_SUPABASE_URL` is set correctly and restart the dev server.
- OAuth errors like `Unsupported provider: provider is not enabled`: enable that provider in the Supabase Dashboard.
- Razorpay checkout not available: verify `https://checkout.razorpay.com/v1/checkout.js` loads in the browser console and your `NEXT_PUBLIC_RAZORPAY_KEY_ID` is present.

## Tests & linting

- Linting is configured with ESLint (`npm run lint`).

## Deploying

- Deploy to Vercel or another Node hosting platform. Ensure server env variables (especially `RAZORPAY_KEY_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`) are set in the deployment environment.

## Next improvements (suggestions)

- Persist unlocks in the database so users don't pay twice.
- Implement a DB-backed admin role and server-side role checks.
- Add a small admin management UI to add/remove admins (writes to a secure DB table).
- Convert CSS variable utilities into Tailwind plugin utilities for responsive variants.

---

If you want, I can update the README to include exact SQL migration commands for your Supabase project or add a Postman/HTTP collection for the API routes. Which would you prefer?
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase + Razorpay integration (local setup)

1. Copy `.env.example` to `.env.local` and fill in your keys.

2. Install dependencies:

```powershell
npm install
npm install @supabase/supabase-js razorpay
```

3. Start Supabase locally (optional):

```powershell
npm install -g supabase
supabase login
supabase start
```

4. Create the `payments` table in your Supabase project SQL editor:

```sql
create table if not exists payments (
	id bigserial primary key,
	user_id uuid not null,
	student_id text not null,
	razorpay_order_id text,
	razorpay_payment_id text,
	amount integer not null,
	created_at timestamptz default now()
);
```

5. Run the Next.js app:

```powershell
npm run dev
```

6. Notes:
- Keep `SUPABASE_SERVICE_ROLE_KEY` and `RAZORPAY_KEY_SECRET` server-only (do not expose to client).
- The Razorpay checkout script is included in `app/layout.js`.


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
