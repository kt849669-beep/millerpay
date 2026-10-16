# Miller Pay

Miller Pay is a full-stack JavaScript application maintained as an npm workspace. It contains two independent React frontends and a secured Node.js API.

## Applications

- `apps/user-app` — customer login, MPIN verification, home dashboard and profile
- `apps/admin-app` — content controls for slides, banners, Telegram prompts and media popups
- `server` — Express API, authentication, media storage and real-time settings updates

## Local development

Double-click `START-MILLER-PAY.bat`, or run:

```powershell
npm install
npm run dev
```

The local services are available at:

- User app: `http://localhost:5173`
- Admin app: `http://localhost:5174`
- API: `http://localhost:5000`

Devices connected to the same Wi-Fi can use the network address shown by Vite when the apps start.

## Environment

Create `server/.env` using `server/.env.example` and keep production secrets out of source control.
Configure separate user/admin JWT secrets, private administrator credentials,
and the Supabase server credentials before deployment. Keep `SUPABASE_SERVICE_KEY` server-only and
never expose it in either frontend bundle. Every security secret must contain at least 64 characters;
the API fails closed when one is missing.

Authentication sessions are delivered through Secure, HttpOnly, SameSite cookies. Administrators sign in with their configured email and password. Password changes require the current password.

The public production domain is `https://millerpay-official.website`.

## Public search pages

Public SEO content is maintained in `seo/`, independently of the user and admin apps.
The production packaging step copies these pages after the app builds, updates only
the built login document's metadata, and generates `robots.txt` and `sitemap.xml`.
Page titles, descriptions and the canonical domain are configured in `seo/site.mjs`.

Run `npm run build:seo` to refresh the SEO output using the existing built login
document, then `npm run check:seo` to validate public links, metadata and sitemap.
See `seo/README.md` for media sources and the remaining domain/indexing setup.

## Production build

```powershell
npm run build
```

The command creates optimized frontend bundles in each application's `dist` directory. Administrator credentials are never rendered in either frontend.
