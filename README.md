# RecIMS App

RecIMS - Receiving and Inventory Management System
A Vite+React app for warehouse and inventory management.

## Persistent storage configuration

The API layer now connects to a managed PostgreSQL instance whenever either of the following is configured:

- `DATABASE_URL` – standard Postgres connection string (e.g. `postgres://user:pass@host:5432/recims`).
- Standard Postgres env parts (`PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, optional `PGPORT`). These map automatically to a connection string so you can reuse secrets that already exist in Amplify/AWS.
- `DATABASE_SSL_MODE` (optional) – one of `disable`, `allow`, `prefer`, `require`, or `strict` (defaults to `require`).

When these variables are omitted the app falls back to the legacy on-disk SQLite database for **local development only**. On any hosted environment you must provide Postgres credentials; otherwise API routes will seed a fresh SQLite file per Lambda and your changes will evaporate across requests. Use `GET /api/debug-env` to confirm the active driver (`persistenceMode` will report `postgres` when things are wired correctly).

## File uploads

Uploads stream directly to S3/Amplify Storage when the following variables are set:

- `UPLOADS_BUCKET` (or `AWS_S3_UPLOAD_BUCKET`) – target S3 bucket name.
- `AWS_REGION` – AWS region for the bucket.
- `UPLOADS_KEY_PREFIX` (optional) – folder/prefix for stored files (defaults to `uploads/`).
- `PUBLIC_UPLOAD_BASE_URL` (optional) – CDN/base URL returned to clients. When omitted the canonical S3 URL is returned.
- `UPLOADS_ACL` (optional) – ACL applied to the uploaded object (`private` by default).

If a bucket is not configured the handler transparently falls back to the former `public/uploads` directory so local development continues to work.

## Maintenance APIs

A new maintenance endpoint lets administrators export or import tenant-level configuration snapshots:

- `GET /api/maintenance/config?tenantId=TNT-001` – returns the tenant record along with categories, contacts, appsettings, and entity_records scoped to the provided tenant.
- `POST /api/maintenance/config` – accepts `{ tenant_id, data }` where `data` mirrors the GET payload. Existing rows for the tenant are replaced with the supplied values.

Both operations require a valid JWT for an `admin` or `super_admin` account. The SDK exposes these helpers via `recims.maintenance.exportConfig(tenantId)` and `recims.maintenance.importConfig(payload)` so they can be wired into cron jobs or manual backup tooling.

## Admin warnings & degraded mode banner

Set `NEXT_PUBLIC_PERSISTENCE_MODE=degraded` (and optionally `NEXT_PUBLIC_PERSISTENCE_MESSAGE`) to surface a dismissible alert for administrators inside the UI, reminding them that saves are temporarily cached. Use `NEXT_PUBLIC_PERSISTENCE_MODE=normal` to disable the banner.

## Demo seed data & offline dropdowns

The UI bootstraps rich demo data via `ensureSeedDataLoaded()` (called from both `pages/_app.jsx` and `src/App.jsx`). The loader tracks a `recims:seed-data-version` flag in `localStorage` and now clears it automatically:

- **Development:** every reload wipes the flag so fresh seeds are written after each code change.
- **Production builds:** the flag is invalidated whenever the Next.js build ID (or commit SHA) changes, so each deploy rehydrates the latest fixtures without manual steps.

Manual refresh is rarely needed, but if you want to force it:

1. Open DevTools → Console.
2. Run `localStorage.removeItem('recims:seed-data-version')`.
3. Refresh the page so `ensureSeedDataLoaded()` can write the latest fixtures.

### What’s included

- Core masters: tenants, tenant categories/contacts, carriers, containers, suppliers, vendors, customers, materials, zones, bins, SKUs, and addresses.
- Inventory objects: stock positions with bin + zone metadata, alert settings, inventory alerts, audit trails, QC criteria/inspections, shift logs, and KPI report history.
- Procurement & shipping: purchase orders plus fully-described line items (skids, actual/certified weights, certificate references), inbound shipments, outbound shipments, waybills/items, and carrier integrations.
- Compliance & communications: destruction/compliance certificates (draft/issued/sent states), signature requests, email templates, QBO connections, and sample audit notes so analytics, certificates, and email screens all have meaningful dropdown choices.

These seeds mirror the entity names registered inside `recimsClient`, so every TanStack Query lookup has at least one cached record even when the API is offline.

The client now merges any successful API responses with the cached entities instead of overwriting them, so data created locally (or provided via seeds) remains available after refreshes, logouts, or other navigation—even if the backend responds with an empty payload. Remote data still wins when an ID matches, but cached-only records stick around for offline/demo flows.

## Running the app

```bash
npm install
npm run dev
```

### Demo accounts

- **Super Admin:** `admin@recims.com` / `admin123`
- **Connecticut Metals (PHASE I–III only):** `admin@clnenv.com` / `phase3only!`

You can override the restricted account via `CLNENV_USER_EMAIL`, `CLNENV_USER_PASSWORD`, or `CLNENV_USER_NAME` when booting the backend server.

## Building the app

```bash
npm run build
```

For more information and support, please contact support at support@recims.com.