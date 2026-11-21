# Deployment

## Target platform

- Cloudflare Workers for frontend hosting and backend services.
- Cloudflare Queues for asynchronous analysis.
- Cloudflare Cron Triggers for reconciliation.
- Dedicated Supabase project for RepoScope.
- GitHub Actions for CI.

## Environment separation

Use separate development and production configuration. Store credentials in managed secret stores. Never commit environment files or local Wrangler secrets.

## Provisioning status

No RepoScope Cloudflare Worker or Supabase project has been provisioned yet. The Projects Account is selected for this product. Provisioning will be performed after the Supabase organization and project settings are confirmed.
