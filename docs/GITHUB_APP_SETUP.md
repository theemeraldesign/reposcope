# RepoScope GitHub App Setup

RepoScope uses a dedicated GitHub App. Do not use a personal access token. The app must be installed only on repositories the user selects.

## Endpoints

- API: https://reposcope-api.reposcope.workers.dev
- Callback URL: https://reposcope-api.reposcope.workers.dev/auth/github/callback
- Setup URL: https://reposcope-api.reposcope.workers.dev/auth/github/setup
- Webhook URL: https://reposcope-api.reposcope.workers.dev/webhooks/github

## Create the app

1. Open https://github.com/settings/apps/new.
2. Set the name to RepoScope.
3. Set the homepage URL to the API URL above for the initial registration. We will update it when the web app domain is connected.
4. Set the callback URL to the callback URL above.
5. Set the setup URL to the setup URL above.
6. Enable webhook delivery and use the webhook URL above.
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

## After creation

Keep these values private and do not commit them:

- GitHub App ID
- GitHub Client ID
- GitHub Client Secret
- GitHub App private key PEM
- Webhook secret

The app ID, private key, and webhook secret will be stored as Cloudflare Worker secrets. The client ID and client secret will be used only for the browser-safe OAuth initiation and server-side token exchange.

Do not paste private keys into GitHub issues, source files, or chat. We will configure them directly in Cloudflare after the app is created.
