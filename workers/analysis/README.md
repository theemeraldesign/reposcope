# Analysis Worker

Cloudflare Worker for queued repository collection, normalisation, analytics, scoring, and AI insight jobs.

## Deployed endpoint

`https://reposcope-analysis.reposcope.workers.dev`

The Worker currently exposes a health response and validates the initial analysis message shape. It does not yet collect repository data or calculate scores. Do not bind a production queue consumer until the processing pipeline and required secrets are ready.

## Required secrets

- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`

The Supabase URL is configured as a non-secret Worker variable.
