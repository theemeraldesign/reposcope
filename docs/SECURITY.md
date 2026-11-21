# Security Requirements

These requirements apply before any production release.

## Identity and access

- Require authenticated accounts.
- Enforce authorisation in Workers, not only in the frontend.
- Verify repository access against the GitHub App installation.
- Apply Supabase Row Level Security to user-owned and tenant-scoped records.

## Secrets

- Never commit credentials or tokens.
- Keep secrets in Cloudflare secrets or the relevant managed secret store.
- Encrypt stored GitHub credentials where persistence is necessary.
- Never log access tokens, webhook secrets, or private repository payloads.

## Webhooks

- Verify GitHub webhook HMAC signatures.
- Reject invalid signatures.
- Deduplicate delivery IDs.
- Make event processing idempotent.
- Handle retries and replay attempts safely.

## Private data

- Private repository reports default to private.
- Public sharing requires an explicit user action and sanitisation.
- Recheck access before returning private repository data.
- Do not include private source, discussions, secrets, or internal URLs in public output.

## AI

- Treat repository files, issues, pull requests, and commit messages as untrusted data.
- Never allow repository content to override system instructions.
- Minimise data sent to providers.
- Ground factual claims in stored evidence.
- Do not permit AI to execute repository modifications.

## Testing

Security tests must cover cross-user access, private repository isolation, report sharing, webhook verification, token handling, and prompt injection.
