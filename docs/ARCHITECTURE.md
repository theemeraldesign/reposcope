# RepoScope Architecture

## Status

Approved target architecture. Implementation has not started beyond the repository foundation.

## System boundaries

- Web application: React + Vite + TypeScript.
- API: Cloudflare Workers. Owns authentication checks, authorisation, GitHub integration, report access, and application APIs.
- Analysis worker: Cloudflare Workers with Queues for asynchronous collection and analysis.
- Database: A dedicated Supabase project for RepoScope. No tables or credentials are shared with other products.
- GitHub integration: A dedicated GitHub App with least-privilege permissions and repository selection.
- Monitoring: GitHub webhooks for event-driven updates, with scheduled reconciliation for missed events.

## Data flow

1. A user authenticates through Supabase Auth.
2. The user connects GitHub through the RepoScope GitHub App.
3. The API verifies the user's session and repository installation access.
4. Collection and analysis jobs are placed on Cloudflare Queues.
5. Workers collect permitted GitHub data and store normalised records and historical snapshots in RepoScope's database.
6. Analytics and scoring are calculated from recorded evidence.
7. AI receives only selected, sanitised evidence and returns qualified explanations.
8. Reports enforce ownership and visibility rules on every request.

## Security boundaries

- Private repository access is always checked server-side.
- Supabase Row Level Security is mandatory for user-owned data.
- GitHub credentials are never exposed to the browser.
- Webhook signatures are verified before processing.
- Webhook events are deduplicated and processed idempotently.
- Public report generation must sanitise private data and require explicit confirmation.
- Repository content is untrusted input, including for AI prompts.

## Reliability

- Use webhook-driven updates instead of aggressive polling.
- Apply GitHub rate-limit-aware backoff and caching.
- Track queue jobs, retries, and terminal failures.
- Reconcile repository state on a scheduled basis.
- Preserve timestamped snapshots for historical comparisons.

## Cost controls

- Prefer free-tier infrastructure where practical.
- Cache expensive collection and AI results.
- Bound analysis depth and AI usage.
- Apply retention policies to historical data.
- Do not assume free, unlimited AI inference.
