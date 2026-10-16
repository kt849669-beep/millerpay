# Miller Pay on Cloudflare

The `millerpay` Worker serves the existing user and admin builds, public SEO pages,
and the existing Express API at `https://millerpay-official.website`.

## Deploy

From the repository root, run:

```sh
npm ci
npm run build
npm run check:seo
npx wrangler@4.149.0 deploy
```

The Cloudflare dashboard manages the root custom domain and the
`www.millerpay-official.website/*` route. The proxied `www` DNS record points to
the root domain. Keep those dashboard-managed domains when deploying.
The Worker redirects `www` to the canonical HTTPS domain.

## Configuration

Store these values as Worker secrets, never in source control:

- `USER_JWT_SECRET`
- `ADMIN_JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

Use the existing production values to preserve sessions and encrypted settings.
The Supabase project must be active and reachable for account and data operations.
`/api/health` checks API availability; it does not verify database availability.

For local testing, put the same variables in an ignored `.dev.vars` file and run
`npx wrangler@4.149.0 dev --port 8791`.

`VERCEL=1` is the existing API's serverless startup switch. It does not send traffic
to another host. The API is initialized inside the first request because Workers
does not permit request-only operations during module initialization.
The Cloudflare-only Morgan alias preserves request logging without dynamic code
generation, which the Workers runtime disallows. Neither application source is
modified by the adapter.

Only the generated `public` directory is served as static assets. API and admin
responses are excluded from indexing. Public pages use the canonical domain,
and `/robots.txt` points crawlers to `/sitemap.xml`.
