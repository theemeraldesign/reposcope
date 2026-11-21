# Continuous Monitoring

## Event sources

Use GitHub webhooks for repository events, including commits, releases, issues, pull requests, reviews, and installation permission changes where supported.

## Processing

1. Verify webhook signature.
2. Deduplicate delivery.
3. Enqueue processing job.
4. Process idempotently.
5. Update event records and snapshots.
6. Detect meaningful changes.
7. Notify users according to preferences.

## Reconciliation

Scheduled jobs must reconcile missed events and refresh metrics at quota-aware intervals. Avoid aggressive polling.

## Reliability

Track retries, dead-letter events, job status, rate limits, and recovery operations.
