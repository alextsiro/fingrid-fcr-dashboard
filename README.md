# Fingrid Balancing Market dashboard

Project handover/status note: see `HANDOVER.md`.

A small mobile-friendly web dashboard for these Fingrid series:
- FCR-N hourly market prices
- FCR-D up hourly market prices
- FCR-D down hourly market prices
- mFRR CM up hourly market prices
- mFRR CM down hourly market prices

## Current UI behavior
- Default range is `1 day`
- Range options are `1 day`, `3 days`, `7 days`
- Summary cards show **average** prices for the currently displayed range
- “Recent hours” sections are collapsible and hidden by default
- Custom favicon is served from `public/favicon.svg`

## How it works
- The browser loads a simple dashboard from `public/`
- The Node server calls Fingrid from `server.mjs`
- Your `x-api-key` stays on the server side and is never exposed to the browser

## Setup
1. Install dependencies:
   - `npm install`
2. Copy the environment file:
   - `Copy-Item .env.example .env`
3. Add your Fingrid API key to `.env`:
   - `FINGRID_API_KEY=...`
4. Start the app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000`

## Optional dataset IDs
If Fingrid's dataset metadata shape changes, you can set the dataset IDs directly in `.env`:
- `FINGRID_DATASET_FCR_N`
- `FINGRID_DATASET_FCR_D_UP`
- `FINGRID_DATASET_FCR_D_DOWN`
- `FINGRID_DATASET_MFRR_CM_UP_PRICE`
- `FINGRID_DATASET_MFRR_CM_DOWN_PRICE`

## API route
The local app exposes:
- `GET /api/fcr-prices?days=1`
- `GET /api/mfrr-cm-prices?days=1`

This route tries to:
1. resolve the three dataset IDs from Fingrid by exact dataset name
2. fetch time-series data from `https://data.fingrid.fi/api/datasets/{datasetId}/data`
3. return merged JSON for the frontend

## Deploy

### Render
1. Push this project to GitHub.
2. In Render, create a new Blueprint service from the repo.
3. Render will detect `render.yaml` automatically.
4. Set these environment variables in Render:
   - `FINGRID_API_KEY`
   - `FINGRID_DATASET_FCR_N` (optional)
   - `FINGRID_DATASET_FCR_D_UP` (optional)
   - `FINGRID_DATASET_FCR_D_DOWN` (optional)
   - `FINGRID_DATASET_MFRR_CM_UP_PRICE` (optional)
   - `FINGRID_DATASET_MFRR_CM_DOWN_PRICE` (optional)
5. Deploy and share the Render URL.

### Railway
1. Push this project to GitHub.
2. In Railway, create a new project from the repo.
3. Railway will use `railway.json` and detect the Node app automatically.
4. Set these environment variables in Railway:
   - `FINGRID_API_KEY`
   - `FINGRID_DATASET_FCR_N` (optional)
   - `FINGRID_DATASET_FCR_D_UP` (optional)
   - `FINGRID_DATASET_FCR_D_DOWN` (optional)
   - `FINGRID_DATASET_MFRR_CM_UP_PRICE` (optional)
   - `FINGRID_DATASET_MFRR_CM_DOWN_PRICE` (optional)
5. Deploy and share the Railway URL.

### Recommended first deploy
- Use Render if you want a very simple shared public URL and repo-based deployment.
- Use Railway if you want fast setup and easy environment variable management.

## Notes
- Fingrid requires `x-api-key` authentication
- The current implementation assumes the dataset data endpoint is `GET /api/datasets/{datasetId}/data`
- If Fingrid uses different query parameter names for time filters in your account, update `fetchSeries()` in `server.mjs`
- Your API key must stay server-side only; do not move it into frontend code
