export default {
  async fetch() {
    return Response.json({
      service: "reposcope-analysis",
      status: "ready",
      queue: "awaiting-github-app-secrets",
    });
  },

  async queue(batch, env) {
    const ready = Boolean(
      env.SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY &&
      env.GITHUB_APP_ID &&
      env.GITHUB_PRIVATE_KEY
    );

    for (const message of batch.messages) {
      const job = message.body;
      if (!job || job.version !== 1 || !job.analysisRunId || !job.repositoryId || !job.installationId) {
        console.error("Rejected malformed RepoScope analysis message.");
        message.ack();
        continue;
      }

      if (!ready) {
        console.error("Analysis worker secrets are incomplete. Message will be retried after setup.");
        message.retry({ delaySeconds: 120 });
        continue;
      }

      console.log("Analysis job received", {
        analysisRunId: job.analysisRunId,
        repositoryId: job.repositoryId,
      });
      message.retry({ delaySeconds: 120 });
    }
  },
};
