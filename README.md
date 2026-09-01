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

Create `server/.env` using `server/.env.example` and keep production secrets out of source control. Configure a strong JWT secret, private administrator credentials and the MongoDB connection before deployment.

The public production domain is `https://millerpay-app.online`.

## Production build

```powershell
npm run build
```

The command creates optimized frontend bundles in each application's `dist` directory. Administrator credentials are never rendered in either frontend.
