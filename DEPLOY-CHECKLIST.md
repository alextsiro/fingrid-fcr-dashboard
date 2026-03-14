# Public deployment checklist

## Before publishing
- Rotate the Fingrid API key because it was shared in chat during setup.
- Keep the new key only in hosting environment variables.
- Do not commit `.env`.

## GitHub
1. Create a new empty GitHub repository.
2. In this folder run:
   - `git add .`
   - `git commit -m "Initial Fingrid dashboard"`
   - `git branch -M main`
   - `git remote add origin YOUR_GITHUB_REPO_URL`
   - `git push -u origin main`

## Render
1. Open Render.
2. Create a new Blueprint service from the GitHub repo.
3. Render reads `render.yaml` automatically.
4. Set environment variables:
   - `FINGRID_API_KEY`
   - `FINGRID_DATASET_FCR_N=317`
   - `FINGRID_DATASET_FCR_D_UP=318`
   - `FINGRID_DATASET_FCR_D_DOWN=283`
5. Deploy and open the generated URL.

## Railway
1. Open Railway.
2. Create a new project from the GitHub repo.
3. Railway reads `railway.json` automatically.
4. Set environment variables:
   - `FINGRID_API_KEY`
   - `FINGRID_DATASET_FCR_N=317`
   - `FINGRID_DATASET_FCR_D_UP=318`
   - `FINGRID_DATASET_FCR_D_DOWN=283`
5. Deploy and open the generated URL.

## Recommended choice
- Use Render for the simplest public share link.
- Use Railway if you want easy runtime management and logs.
