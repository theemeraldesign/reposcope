# API Worker

Cloudflare Worker for RepoScope's authenticated API, GitHub App installation, and webhook intake.

## Deployed endpoint

`https://reposcope-api.reposcope.workers.dev`

## Routes

- `GET /health`: service and integration configuration status.
- `GET /v1/me`: validates the Supabase bearer token and returns the signed-in user.
- `GET /v1/repositories`: returns repositories visible to the authenticated user through Supabase RLS.
- `GET /auth/github/install`: starts the GitHub App installation flow for an authenticated user.
- `GET /auth/github/setup`: verifies signed installation state and stores the installation.
- `POST /webhooks/github`: verifies GitHub webhook HMAC signatures, stores delivery records, and publishes event references to the events queue.

## Runtime configuration

Non-secret variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `APP_ORIGIN`

Cloudflare secrets required for GitHub integration:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_STATE_SECRET`

The event queue is bound as `EVENTS_QUEUE`. The GitHub installation and webhook routes return a configuration error until the required secrets exist.
