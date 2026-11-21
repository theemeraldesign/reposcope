# RepoScope

GitHub intelligence for repository analytics, continuous monitoring, AI-assisted insights, and software project health reports.

## Project status

The engineering foundation is in progress. The Supabase project is connected and its initial schema is deployed. The React + Vite web application shell and authentication screens are committed. GitHub App integration, API authorization, repository collection, analysis processing, and production deployment remain in progress.

## Planned capabilities

- Public and private repository analysis through an authorised GitHub App
- Repository activity, contributor, issue, pull request, and dependency analytics
- Explainable repository health scoring
- Continuous monitoring and notifications
- Evidence-grounded AI explanations and recommendations
- Interactive reports, PDF exports, and controlled share links

## Technology

- React, Vite, and TypeScript
- Cloudflare Workers, Queues, and Cron Triggers
- Supabase PostgreSQL and Auth
- GitHub App and GitHub APIs
- pnpm workspaces

## Local development

1. Copy `apps/web/.env.example` to `apps/web/.env.local`.
2. Set the Supabase project URL and publishable key.
3. Install dependencies with `pnpm install`.
4. Start the frontend with `pnpm dev`.

Never place Supabase secret/service-role keys in the frontend environment.

## Security

Private repository data must remain private. All access decisions must be enforced server-side and backed by database policies. Never commit credentials, tokens, private repository contents, or production secrets.

## Documentation

See `docs/` for architecture and engineering decisions.

## License

License selection is pending final review.
