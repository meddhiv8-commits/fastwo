# Fastwo TN

Fastwo is a React marketplace demo for second-hand products in Tunisia. The app includes the demo catalog, product details, favorites, cart and checkout, price negotiation, seller tools, and an admin dashboard. Negotiations allow up to eight offers per item with a maximum 10% reduction. Demo data is saved in the browser with `localStorage`.

Requires Node.js 20 or newer. From the project root in PowerShell, install both packages and launch the backend:

```powershell
npm install --prefix frontend
npm install --prefix backend
npm run dev --prefix backend
```

The backend builds the React app, starts the API and website at <http://localhost:3001>, and opens that address in your browser. For frontend-only development, run `npm run dev --prefix frontend` and open <http://localhost:5173>.

### Demo access

- Customer/seller: enter any name and Tunisian phone number, then use `1234` as the local demo verification code.
- Admin: open `/admin/login`; local development uses `admin23191`. Production requires the private `ADMIN_PASSWORD` environment variable.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the Render deployment steps and production data limitations.

## Routes

| Route                            | Page                            | Access              |
| -------------------------------- | ------------------------------- | ------------------- |
| `/`                              | Shop and customer reviews       | Public              |
| `/products/:productId`           | Product details                 | Public              |
| `/products/:productId/negotiate` | Negotiate an item               | Signed-in demo user |
| `/wishlist`                      | Favorites                       | Public              |
| `/login`                         | Customer/seller sign-in         | Public              |
| `/sell`                          | Submit an item                  | Signed-in demo user |
| `/seller`                        | Seller inventory and prices     | Signed-in demo user |
| `/admin/login`                   | Admin sign-in                   | Public              |
| `/admin`                         | Moderation, orders, and catalog | Demo admin          |

The original single-file demo remains at `frontend/index.html`. The React/Vite application is in `frontend/react-app`.

The Express API works locally without Supabase: OTP `1234`, profiles, and sessions are held in memory and are cleared when the server stops. For persistent sessions and real WhatsApp delivery:

1. Run `backend/supabase/schema.sql` in the Supabase SQL editor.
2. Copy `backend/.env.example` to `backend/.env` and set `SUPABASE_URL` and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Add Meta WhatsApp Cloud API credentials to `backend/.env` to deliver real codes. Without WhatsApp credentials, generated codes are printed in the backend terminal.
4. Restart the backend with `npm run dev --prefix backend`.

When using the Vite dev server on port 5173, copy `frontend/.env.example` to `frontend/.env.local` and restart Vite to connect it to the API.

Never put the Supabase service-role key or WhatsApp token in the frontend. Optional direct Supabase data sync remains disabled; do not expose those tables to anonymous browser writes without suitable RLS policies and server-side validation.

## Structure

```text
frontend/
  react-app/src/          React pages, components, state, and route guards
  react-app/index.html    Vite application entry
  index.html              Original single-file demo
  package.json            React/Vite scripts and dependencies
  vite.config.js          Vite root and build configuration
  .env.example            Optional frontend API URL
backend/
  server.js               Express authentication API
  package.json            Backend dependencies
  .env.example            Backend configuration template
  supabase/schema.sql     Database tables
index.html                Local app link and startup hint
```
