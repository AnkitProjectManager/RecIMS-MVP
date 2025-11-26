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

## Running the app

```bash
npm install
npm run dev
```

## Building the app

```bash
npm run build
```

For more information and support, please contact support at support@recims.com.