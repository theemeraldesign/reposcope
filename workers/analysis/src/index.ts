interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
}

type AnalysisMessage = {
  version: 1;
  analysisRunId: string;
  repositoryId: string;
  owner: string;
  repository: string;
  installationId: number;
  requestedBy: string;
};

export default {
  async fetch(): Promise<Response> {
    return Response.json({ service: "reposcope-analysis", status: "ready", queue: "awaiting-binding" });
  },

  async queue(batch: MessageBatch<AnalysisMessage>, env: Env): Promise<void> {
    const required = [env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, env.GITHUB_APP_ID, env.GITHUB_PRIVATE_KEY];
    if (required.some((value) => !value)) {
      console.error("Analysis worker secrets are incomplete. Messages will be retried.");
      for (const message of batch.messages) message.retry({ delaySeconds: 60 });
      return;
    }

    for (const message of batch.messages) {
      const payload = message.body;
      if (
        payload?.version !== 1 ||
        !payload.analysisRunId ||
        !payload.repositoryId ||
        !payload.owner ||
        !payload.repository ||
        !payload.installationId ||
        !payload.requestedBy
      ) {
        console.error("Rejected malformed RepoScope analysis message.");
        message.ack();
        continue;
      }

      // Repository collection and scoring are implemented in the next integration step.
      // Keep messages retryable until the GitHub App and database write path are configured.
      console.log("Analysis job accepted for processing", {
        analysisRunId: payload.analysisRunId,
        repository: `${payload.owner}/${payload.repository}`,
      });
      message.retry({ delaySeconds: 60 });
    }
  },
};
