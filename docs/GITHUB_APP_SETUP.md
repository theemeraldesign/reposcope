# RepoScope GitHub App Setup

RepoScope uses a dedicated GitHub App. Do not use a personal access token. The app must be installed only on repositories the user selects.

## Endpoints

- API: https://reposcope-api.reposcope.workers.dev
- Setup URL: https://reposcope-api.reposcope.workers.dev/auth/github/setup
- Webhook URL: https://reposcope-api.reposcope.workers.dev/webhooks/github

The setup URL is GitHub's post-installation callback. A separate OAuth callback URL is not required for the installation-based flow because users sign in to RepoScope with Supabase Auth.

## Create the app

1. Open https://github.com/settings/apps/new.
2. Set the name to RepoScope.
3. Set the homepage URL to https://reposcope-api.reposcope.workers.dev for initial registration. We will update it after the web application has its own domain.
4. Leave OAuth callback URLs empty for now.
5. Set the setup URL to https://reposcope-api.reposcope.workers.dev/auth/github/setup.
6. Enable webhook delivery and use https://reposcope-api.reposcope.workers.dev/webhooks/github.
7. Generate a strong webhook secret and store it securely.
8. Keep the app private. Do not publish it to the GitHub Marketplace.

## Repository permissions

Grant read-only access to:

- Metadata
- Contents
- Issues
- Pull requests
- Commit statuses
- Checks
- Actions
- Members

Do not grant write permissions. RepoScope only needs to inspect repositories and report findings.

## Webhook events

Subscribe to:

- Push
- Issues
- Issue comments
- Pull requests
- Pull request reviews
- Release
- Check runs
- Check suites
- Workflow runs

## Values to retain

After creating the app, keep these values:

- GitHub App ID
- GitHub App slug
- GitHub App private key PEM
- Webhook secret

The App ID, private key, and webhook secret must be stored as Cloudflare Worker secrets. The App slug and a separate random state-signing secret are also needed as Worker secrets or variables.

Never commit credentials or paste the private key into GitHub issues, source files, or chat.

## Cloudflare secrets

Configure these on the `reposcope-api` Worker:

- `GITHUB_APP_ID`
- `GITHUB_APP_SLUG`
- `GITHUB_PRIVATE_KEY`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_STATE_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

Configure these on the `reposcope-analysis` Worker:

- `GITHUB_APP_ID`
- `GITHUB_PRIVATE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key must remain server-side. Never add it to the frontend or Git repository.
