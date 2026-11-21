# RepoScope Infrastructure Inventory

Cloudflare account: Projects Account
Cloudflare account ID: c76cbb7dc13126491526912181cae743
GitHub repository: theemeraldesign/reposcope
Supabase project: reposcope
Supabase project ref: cwiusrxpnlzewwjnqwtm
Supabase region: eu-west-1
Workers.dev subdomain: reposcope.workers.dev

## Provisioned resources

| Resource | Name | Purpose | Status |
|---|---|---|---|
| Worker | reposcope-api | Authenticated API, GitHub App setup and webhook intake | Deployed |
| Worker | reposcope-analysis | Background repository analysis entrypoint | Deployed, processing pending |
| Queue | reposcope-analysis | Repository analysis jobs | Created, no producer or consumer |
| Queue | reposcope-events | GitHub webhook event intake | Created, API producer bound |
| Supabase | reposcope | Auth and PostgreSQL database | Active, schema deployed |

## Worker endpoints

- API health: https://reposcope-api.reposcope.workers.dev/health
- Authenticated user endpoint: https://reposcope-api.reposcope.workers.dev/v1/me
- User-scoped repository endpoint: https://reposcope-api.reposcope.workers.dev/v1/repositories
- GitHub installation start: https://reposcope-api.reposcope.workers.dev/auth/github/install
- GitHub installation setup callback: https://reposcope-api.reposcope.workers.dev/auth/github/setup
- GitHub webhook: https://reposcope-api.reposcope.workers.dev/webhooks/github

The API's Supabase URL and publishable key are configured as non-secret Worker variables. The API validates Supabase access tokens before returning user-scoped data. GitHub installation and webhook routes remain disabled until their required Cloudflare secrets are configured.

## Database foundation

The initial schema contains profiles, GitHub installations, repositories, repository snapshots, analysis runs, reports, and webhook delivery records. Row Level Security is enabled on every public table. The webhook delivery table has no client policies by design and is intended for trusted server-side processing only.

## Important notes

- API source is deployed to Cloudflare and tracked in GitHub.
- The analysis Worker is deployed with its health endpoint and queue handler scaffold. Repository collection and scoring are not yet implemented.
- The API Worker is bound as a producer to `reposcope-events`. No queue consumers are configured yet.
- The analysis queue has no producer or consumer yet.
- Cron Triggers are intentionally not enabled until scheduled handlers are implemented and tested.
- No custom domain or frontend hosting is attached yet.
- GitHub App credentials and Supabase service-role credentials have not been configured.
- No existing Worker was modified. The existing DevLens Worker remains separate and untouched.
