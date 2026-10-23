# SurakshaHub — Render deployment

This version is adapted to run as a regular Node.js web service on Render. It serves the Vite-built frontend and the `/api` backend from the same service. It does not use Supabase or Vercel Functions.

## Deploy on Render

1. Extract this ZIP and upload the **contents** of `Smart-Building-main` to a GitHub repository (the `package.json`, `server.js`, `api/`, `src/`, and `index.html` should be at the repository root).
2. In Render, choose **New + → Web Service**, connect GitHub, and select the repository.
3. Use these settings:
   - Runtime: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Instance type: choose an available plan appropriate for testing
4. Create/connect a PostgreSQL database. You can use Render Postgres or a managed provider such as Neon. Add its connection string as `DATABASE_URL` in the web service's Environment settings. For Neon, use the provider's pooled or standard connection string compatible with `postgres` and SSL.
5. Add these environment variables in Render:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: random secret at least 32 characters long
   - `BOOTSTRAP_ADMIN_USERNAME`: initial admin username (3–32 characters; lowercase letters, numbers, dot, underscore, hyphen)
   - `BOOTSTRAP_ADMIN_PASSWORD`: initial admin password, at least 12 characters
6. Deploy. Visit `https://YOUR-SERVICE.onrender.com/api/health`. It should return `{"ok":true,"service":"SurakshaHub API"}`.

Render sets `PORT` automatically; `server.js` uses it. No `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, or Vercel configuration is needed.

## Authentication and roles

- Signup creates a `student` account; it cannot publicly create an administrator.
- Passwords are hashed with bcrypt; session tokens are stored in an HTTP-only cookie.
- The first admin is bootstrapped only when no admin already exists and both bootstrap variables are valid. After the admin account is created, change or remove the bootstrap password environment variable if desired, then redeploy.
- Admins can assign roles and work orders. Maintenance staff can update assigned work to `In progress` or `Awaiting verification`; only admins can mark work `Completed` after verification.

## Notes

- Tables and sample assets are initialized by the API when it first receives a request. Keep the database connection string and JWT secret private.
- Use a persistent managed PostgreSQL database; do not use an ephemeral filesystem for application data.
- The source is syntax-checked, but you should run a real deployment and test signup/login, role assignment, and maintenance verification before using real operational data.
