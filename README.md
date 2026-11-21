# RepoScope

GitHub intelligence for repository analytics, continuous monitoring, AI-assisted insights, and software project health reports.

## Project status

RepoScope is in its initial engineering-foundation stage. Product scope and architecture are approved. Features are not yet implemented.

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

## Security

Private repository data must remain private. All access decisions must be enforced server-side and backed by database policies. Never commit credentials, tokens, private repository contents, or production secrets.

## Documentation

See docs/ for architecture and engineering decisions.

## License

License selection is pending final review.
