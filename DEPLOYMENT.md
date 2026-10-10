# Deploy Fastwo

Deploy the API to Render and the frontend to Netlify. Alternatively, Render can serve both from one origin using the Blueprint below.

## Netlify Frontend

Netlify can host the static frontend, but the API must run separately. Deploy the backend to Render using the steps below, then:

1. Import the repository into Netlify and keep the repository root as the base directory. `netlify.toml` builds from `frontend`, publishes `frontend/dist`, and sets `VITE_FASTWO_AUTH_API` to `https://fastwo1.onrender.com`.
2. If the Render service URL changes, update `VITE_FASTWO_AUTH_API` in `netlify.toml` or override it in Netlify environment variables.
3. Trigger a new deploy so Vite includes the API URL in the frontend build.

Do not set the production API URL to `localhost`.

## Render Blueprint

1. Push this repository to GitHub or GitLab.
2. In Render, choose **New + → Blueprint** and connect the repository.
3. Render reads `render.yaml`. When prompted, enter the required private environment values:
   - `ADMIN_PASSWORD`: set a new, strong private password.
   - `SUPABASE_URL`: the project URL from Supabase.
   - `SUPABASE_SERVICE_ROLE_KEY`: the server-only service-role key. Never put this in a Vite variable or commit it.
   - `APP_PUBLIC_URL`: set this to the public Netlify frontend URL, with no trailing slash.
   - `ALLOWED_ORIGINS`: set this to the same Netlify frontend origin, with no trailing slash.
4. Apply `backend/supabase/schema.sql` in the Supabase SQL editor before using persistent database routes.
5. Deploy the service and check `https://fastwo1.onrender.com/api/health`. Use the Netlify URL for the website and the Render URL for API requests.

For a manual Render service, use the repository root as the root directory, Node runtime, build command `npm ci --prefix frontend && npm ci --prefix backend && npm run build --prefix frontend`, and start command `node backend/server.js`.

## Optional WhatsApp Cloud API

Add these as private Render environment variables to enable real WhatsApp delivery:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_NEGOTIATION_TEMPLATE`
- `WHATSAPP_NEGOTIATION_RESPONSE_TEMPLATE`
- `WHATSAPP_NEGOTIATION_LANGUAGE`

Meta requires approved templates for business-initiated messages outside the customer-service window. The number managed in Admin controls website `wa.me` contact links; the sender for Cloud API messages is the Business number tied to `WHATSAPP_PHONE_NUMBER_ID`.

## Important Data Scope

This is currently a deployable demo, not yet a fully persistent multi-user marketplace. Customer/seller sessions and offers have server/Supabase paths, but product submissions, cart, reviews, and several marketplace actions still use browser `localStorage`. Different visitors therefore do not automatically share those records. Do not treat the deployment as production commerce until those remaining writes are moved behind authenticated server APIs and tested with suitable database policies.

Admin login uses a server-validated password. In production `ADMIN_PASSWORD` must be set in Render; the local development fallback is not used when `NODE_ENV=production`.
