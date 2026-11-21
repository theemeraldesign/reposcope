# RepoScope Infrastructure Inventory

Cloudflare account: Projects Account
Cloudflare account ID: c76cbb7dc13126491526912181cae743
GitHub repository: theemeraldesign/reposcope
Supabase project: reposcope
Supabase project ref: cwiusrxpnlzewwjnqwtm
Supabase region: eu-west-1
Deployment region preference: Europe where supported.

## Provisioned resources

| Resource | Name | Purpose | Status |
|---|---|---|---|
| Worker | reposcope-api | API entrypoint scaffold | Created |
| Worker | reposcope-analysis | Background analysis entrypoint scaffold | Created |
| Queue | reposcope-analysis | Repository analysis jobs | Created |
| Queue | reposcope-events | Domain events and processing signals | Created |
| Supabase | reposcope | Auth and PostgreSQL database | Active, schema deployed |

## Database foundation

The initial schema contains profiles, GitHub installations, repositories, repository snapshots, analysis runs, reports, and webhook delivery records. Row Level Security is enabled on every public table. The webhook delivery table has no client policies by design and is intended for trusted server-side processing only.

## Important notes

- Workers are still scaffolds. Production routes, authentication, GitHub integration, queue bindings, and monitoring logic remain to be implemented.
- Queue consumers and producers are not yet bound. Bind them when application worker code and message contracts are implemented.
- Cron Triggers are intentionally not enabled until scheduled handlers are implemented and tested.
- No existing Worker was modified. The existing DevLens Worker remains separate and untouched.
- No custom domain or DNS route has been attached yet.
- No secrets have been configured. Never add private keys or service-role credentials to Git.
