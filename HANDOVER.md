# Handover / Project status

## What has been implemented
A mobile-first, shareable web dashboard scaffold is complete.

### Backend
- File: `server.mjs`
- Uses Express server and serves static UI from `public/`
- Adds health endpoint: `GET /api/health`
- Adds data endpoint: `GET /api/fcr-prices?days=...`
- Keeps Fingrid key server-side using `x-api-key` header
- Attempts to resolve dataset IDs by exact dataset names:
  - Frequency Containment Reserve for Normal operation, hourly market prices
  - Frequency Containment Reserve for Disturbances upwards regulation, hourly market prices
  - Frequency Containment Reserve for Disturbances downwards regulation, hourly market prices
- Supports optional manual overrides through env vars:
  - `FINGRID_DATASET_FCR_N`
  - `FINGRID_DATASET_FCR_D_UP`
  - `FINGRID_DATASET_FCR_D_DOWN`

### Frontend
- Files: `public/index.html`, `public/app.js`, `public/styles.css`
- Responsive phone-friendly UI
- Range selector (3/7/14/30 days)
- Latest cards for FCR-N, FCR-D up, FCR-D down
- Line chart using Chart.js
- Recent rows table

### Deployment
- Render config: `render.yaml`
- Railway config: `railway.json`
- Setup and deploy instructions in `README.md`

## Environment/config files added
- `package.json`
- `.env.example`
- `.gitignore`

## Current local status
- Node.js is installed locally and the app has been run successfully.
- Health check and live data fetch were verified after adding retry/cache handling for Fingrid rate limits.

## What is already known about Fingrid access
- Data is open/public, but API access still requires a key.
- Missing key returns HTTP 401 from `https://data.fingrid.fi/api/datasets`.

## Live API status (updated)
- API key has been provided and wired into local `.env`.
- Resolved dataset IDs:
  - `FINGRID_DATASET_FCR_N=317`
  - `FINGRID_DATASET_FCR_D_UP=318`
  - `FINGRID_DATASET_FCR_D_DOWN=283`
- Verified endpoint and query pattern with real data:
  - `GET https://data.fingrid.fi/api/datasets/317/data?startTime=...&endTime=...`
  - Response rows include: `datasetId`, `startTime`, `endTime`, `value`.

## Next steps
- Rotate the Fingrid API key before public deployment because it was shared during setup.
- Keep the new key only in hosting environment variables.
- Deploy via Render or Railway using the fixed dataset IDs:
  - `FINGRID_DATASET_FCR_N=317`
  - `FINGRID_DATASET_FCR_D_UP=318`
  - `FINGRID_DATASET_FCR_D_DOWN=283`
