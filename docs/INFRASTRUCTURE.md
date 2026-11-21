# RepoScope Infrastructure Inventory

Cloudflare account: Projects Account
GitHub repository: theemeraldesign/reposcope
Deployment region preference: Europe where supported.

## Provisioned resources

| Resource | Name | Purpose | Status |
|---|---|---|---|
| Worker | reposcope-api | API entrypoint scaffold | Created |
| Worker | reposcope-analysis | Background analysis entrypoint scaffold | Created |
| Queue | reposcope-analysis | Repository analysis jobs | Created |
| Queue | reposcope-events | Domain events and processing signals | Created |

## Important notes

- These Workers are scaffolds. Production routes, authentication, GitHub integration, queue bindings, and monitoring logic remain to be implemented.
- Queue consumers and producers are not yet bound. Bind them when the application worker code and message contracts are implemented.
- Cron Triggers are intentionally not enabled until scheduled handlers are implemented and tested.
- No existing Worker was modified. The existing DevLens Worker remains separate and untouched.
- No custom domain or DNS route has been attached yet.

## Supabase blocker

The separate `reposcope` Supabase project could not be created because the Projects Account organization has reached its limit of two active free projects. The existing projects are:
- `devlens` (ACTIVE_HEALTHY)
- `hizzywizzy431 21@gmail.com's Project` (ACTIVE_HEALTHY)

Neither project was paused, deleted, or modified. RepoScope database migrations must wait until the user chooses an approved path: upgrade the organization, pause an existing project, or select a different Supabase organization.
