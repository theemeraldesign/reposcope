const encoder = new TextEncoder();
const API_VERSION = "2022-11-28";

function b64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

function pkcs1ToPkcs8(pem) {
  const body = pem.replace(/-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\s/g, "");
  const key = fromB64(body);
  const length = key.length;
  const contentLength = length + 22;
  const prefix = new Uint8Array([
    0x30, 0x82, (contentLength >> 8) & 255, contentLength & 255,
    0x02, 0x01, 0x00,
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    0x04, 0x82, (length >> 8) & 255, length & 255,
  ]);
  const output = new Uint8Array(prefix.length + length);
  output.set(prefix);
  output.set(key, prefix.length);
  return output;
}

async function createAppJwt(env) {
  const pem = env.GITHUB_PRIVATE_KEY.trim();
  const keyBytes = pem.includes("BEGIN RSA PRIVATE KEY")
    ? pkcs1ToPkcs8(pem)
    : fromB64(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""));
  const key = await crypto.subtle.importKey(
    "pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = b64url(encoder.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })));
  const unsigned = header + "." + payload;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned)));
  return unsigned + "." + b64url(signature);
}

async function githubRequest(path, token) {
  const response = await fetch("https://api.github.com" + path, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: "Bearer " + token,
      "x-github-api-version": API_VERSION,
      "user-agent": "RepoScope",
    },
  });
  if (!response.ok) {
    const error = new Error("GitHub API request failed");
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return response.json();
}

async function adminRequest(path, env, options = {}) {
  const response = await fetch(new URL(path, env.SUPABASE_URL), {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const error = new Error("Supabase database request failed");
    error.status = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    error.detail = (await response.text()).slice(0, 500);
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function scoreActivity(commits) {
  const now = Date.now();
  const days = [30, 90, 180];
  const counts = Object.fromEntries(days.map((d) => [d, 0]));
  for (const commit of commits || []) {
    const date = Date.parse(commit.commit?.author?.date || commit.commit?.committer?.date || "");
    if (!Number.isFinite(date)) continue;
    const age = (now - date) / 86400000;
    for (const d of days) if (age <= d) counts[d] += 1;
  }
  const score = Math.min(100, counts[30] * 5 + counts[90] * 1.5 + counts[180] * 0.35);
  return { score: Math.round(score), counts };
}

export function scoreRepository(data) {
  const { repo, languages, commits, issues, pulls, readme, contents } = data;
  const findings = [];
  const dimensions = {};

  const activity = scoreActivity(commits);
  dimensions.development_activity = {
    score: activity.score,
    weight: 20,
    evidence: { commits_30d: activity.counts[30], commits_90d: activity.counts[90], commits_180d: activity.counts[180] },
  };
  if (activity.counts[90] === 0) findings.push({ severity: "warning", category: "activity", title: "No recent commits found", detail: "No commits were found in the sampled history from the last 90 days." });

  const ageDays = repo.pushed_at ? Math.max(0, (Date.now() - Date.parse(repo.pushed_at)) / 86400000) : null;
  let maintenance = ageDays === null ? 35 : ageDays <= 30 ? 100 : ageDays <= 90 ? 80 : ageDays <= 180 ? 60 : ageDays <= 365 ? 35 : 15;
  const hasWorkflows = contents.some((item) => item.path.startsWith(".github/workflows/"));
  if (hasWorkflows) maintenance = Math.min(100, maintenance + 10);
  if (repo.archived) maintenance = 0;
  dimensions.maintenance = { score: maintenance, weight: 20, evidence: { days_since_push: ageDays === null ? null : Math.round(ageDays), archived: repo.archived, github_actions_workflows: hasWorkflows } };
  if (repo.archived) findings.push({ severity: "warning", category: "maintenance", title: "Repository is archived", detail: "GitHub marks this repository as archived." });
  else if (ageDays !== null && ageDays > 180) findings.push({ severity: "warning", category: "maintenance", title: "Repository has low recent activity", detail: "The latest push is more than 180 days old." });

  const communityScore = Math.min(100, Math.round(Math.log10(1 + repo.stargazers_count) * 22 + Math.log10(1 + repo.forks_count) * 16 + Math.log10(1 + repo.subscribers_count) * 10));
  dimensions.community_engagement = { score: communityScore, weight: 15, evidence: { stars: repo.stargazers_count, forks: repo.forks_count, watchers: repo.subscribers_count } };

  let docs = readme ? 55 : 0;
  const paths = contents.map((item) => item.path.toLowerCase());
  const hasDocs = paths.some((p) => p === "docs" || p.startsWith("docs/"));
  const hasLicense = Boolean(repo.license);
  const hasContributing = paths.includes("contributing.md") || paths.includes(".github/contributing.md");
  if (hasDocs) docs += 20;
  if (hasLicense) docs += 15;
  if (hasContributing) docs += 10;
  dimensions.documentation = { score: Math.min(100, docs), weight: 15, evidence: { readme_present: Boolean(readme), docs_directory: hasDocs, license_detected: hasLicense, contributing_guide: hasContributing } };
  if (!readme) findings.push({ severity: "high", category: "documentation", title: "README is missing", detail: "Add a README explaining the project's purpose, setup and usage." });
  if (!hasLicense) findings.push({ severity: "warning", category: "documentation", title: "No license detected", detail: "A license file or GitHub-detected license was not found." });

  const openIssues = issues.filter((issue) => !issue.pull_request);
  const closedIssues = issues.filter((issue) => issue.state === "closed");
  const managedRatio = issues.length ? closedIssues.length / issues.length : 0.5;
  const prMerged = pulls.filter((pr) => pr.merged_at).length;
  const prRatio = pulls.length ? prMerged / pulls.length : 0.5;
  const issueScore = Math.round(Math.min(100, 35 + managedRatio * 35 + prRatio * 30));
  dimensions.issue_pr_management = { score: issueScore, weight: 15, evidence: { sampled_issues: issues.length, sampled_open_issues: openIssues.length, sampled_closed_issues: closedIssues.length, sampled_pull_requests: pulls.length, merged_pull_requests: prMerged } };

  const hasManifest = paths.some((p) => ["package.json", "pyproject.toml", "requirements.txt", "go.mod", "cargo.toml", "pom.xml", "build.gradle", "composer.json"].includes(p));
  const hasLockfile = paths.some((p) => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|poetry\.lock|cargo\.lock|go\.sum|composer\.lock)$/.test(p));
  const hasDependabot = paths.includes(".github/dependabot.yml") || paths.includes(".github/dependabot.yaml");
  const hasRenovate = paths.includes("renovate.json") || paths.includes(".renovaterc");
  let dependencyScore = hasManifest ? 45 : 25;
  if (hasLockfile) dependencyScore += 25;
  if (hasDependabot || hasRenovate) dependencyScore += 30;
  dimensions.dependency_health = { score: dependencyScore, weight: 15, evidence: { manifest_detected: hasManifest, lockfile_detected: hasLockfile, automated_updates: hasDependabot || hasRenovate } };
  if (hasManifest && !hasLockfile) findings.push({ severity: "warning", category: "dependencies", title: "No dependency lockfile detected", detail: "A lockfile helps make dependency installations reproducible." });
  if (hasManifest && !hasDependabot && !hasRenovate) findings.push({ severity: "info", category: "dependencies", title: "Automated dependency updates not detected", detail: "Consider enabling Dependabot or Renovate." });

  const weights = Object.values(dimensions);
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round(weights.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
  return { score, dimensions, findings, activity };
}

async function processWebhookEvent(job, env) {
  const rows = await adminRequest(
    "/rest/v1/webhook_deliveries?select=delivery_id,event_type,installation_id,payload&delivery_id=eq." + encodeURIComponent(job.deliveryId),
    env
  );
  const delivery = rows?.[0];
  if (!delivery) return { skipped: "delivery_not_found" };

  const supported = new Set(["push", "issues", "issue_comment", "pull_request", "pull_request_review", "release", "check_run", "check_suite", "workflow_run"]);
  const repositoryGithubId = delivery.payload?.repository?.id;
  if (!supported.has(delivery.event_type) || !repositoryGithubId || !delivery.installation_id) {
    await adminRequest("/rest/v1/webhook_deliveries?delivery_id=eq." + encodeURIComponent(job.deliveryId), env, {
      method: "PATCH", body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: null }),
    });
    return { skipped: "event_not_actionable" };
  }

  const repositories = await adminRequest(
    "/rest/v1/repositories?select=id,owner_id,installation_id,full_name&github_repo_id=eq." + encodeURIComponent(repositoryGithubId) + "&installation_id=eq." + encodeURIComponent(delivery.installation_id),
    env
  );
  for (const repository of repositories || []) {
    const created = await adminRequest("/rest/v1/analysis_runs", env, {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ repository_id: repository.id, requested_by: repository.owner_id, status: "queued" }),
    });
    const runs = await created;
    if (runs?.[0]?.id) {
      await processAnalysis({
        version: 1,
        analysisRunId: runs[0].id,
        repositoryId: repository.id,
        installationId: delivery.installation_id,
      }, env);
    }
  }
  await adminRequest("/rest/v1/webhook_deliveries?delivery_id=eq." + encodeURIComponent(job.deliveryId), env, {
    method: "PATCH", body: JSON.stringify({ processed_at: new Date().toISOString(), processing_error: null }),
  });
  return { repositoriesAnalyzed: repositories?.length || 0 };
}

async function processAnalysis(job, env) {
  const rows = await adminRequest(
    "/rest/v1/repositories?select=id,owner_id,installation_id,full_name,visibility&id=eq." + encodeURIComponent(job.repositoryId),
    env
  );
  const repository = rows?.[0];
  if (!repository) throw Object.assign(new Error("Repository record not found"), { permanent: true });
  const installationId = Number(job.installationId || repository.installation_id);
  if (!Number.isSafeInteger(installationId) || installationId <= 0) throw Object.assign(new Error("GitHub installation is missing"), { permanent: true });

  await adminRequest("/rest/v1/analysis_runs?id=eq." + encodeURIComponent(job.analysisRunId), env, {
    method: "PATCH", body: JSON.stringify({ status: "running", started_at: new Date().toISOString(), error_code: null }),
  });

  const appJwt = await createAppJwt(env);
  const tokenResponse = await fetch("https://api.github.com/app/installations/" + installationId + "/access_tokens", {
    method: "POST",
    headers: { accept: "application/vnd.github+json", authorization: "Bearer " + appJwt, "x-github-api-version": API_VERSION, "content-type": "application/json", "user-agent": "RepoScope" },
    body: "{}",
  });
  if (!tokenResponse.ok) throw Object.assign(new Error("Could not obtain GitHub installation token"), { status: tokenResponse.status, retryable: tokenResponse.status === 429 || tokenResponse.status >= 500 });
  const installationToken = (await tokenResponse.json()).token;
  const [repo, languages, commits, issues, pulls, readmeResult, rootContents, githubDir, workflows] = await Promise.all([
    githubRequest("/repos/" + repository.full_name, installationToken),
    githubRequest("/repos/" + repository.full_name + "/languages", installationToken).catch(() => ({})),
    githubRequest("/repos/" + repository.full_name + "/commits?per_page=100", installationToken).catch(() => []),
    githubRequest("/repos/" + repository.full_name + "/issues?state=all&per_page=100", installationToken).catch(() => []),
    githubRequest("/repos/" + repository.full_name + "/pulls?state=all&per_page=100", installationToken).catch(() => []),
    githubRequest("/repos/" + repository.full_name + "/readme", installationToken).catch(() => null),
    githubRequest("/repos/" + repository.full_name + "/contents", installationToken).catch(() => []),
  ]);
  const readme = Boolean(readmeResult);
  const contentPaths = Array.isArray(rootContents) ? rootContents : [];
  const githubContents = [...contentPaths, ...(Array.isArray(githubDir) ? githubDir : []), ...(Array.isArray(workflows) ? workflows : [])];
  const score = scoreRepository({ repo, languages, commits, issues, pulls, readme, contents: githubContents });

  const snapshot = {
    repository_id: repository.id,
    stars_count: repo.stargazers_count || 0,
    forks_count: repo.forks_count || 0,
    open_issues_count: repo.open_issues_count || 0,
    subscribers_count: repo.subscribers_count || 0,
    commit_activity: score.activity.counts,
    metadata: {
      pushed_at: repo.pushed_at,
      created_at: repo.created_at,
      updated_at: repo.updated_at,
      language: repo.language,
      languages,
      topics: repo.topics || [],
      default_branch: repo.default_branch,
      visibility: repo.visibility,
      license: repo.license?.spdx_id || null,
      scoring_version: "0.1.0",
      scoring_note: "Heuristic repository health indicators, not a measure of developer skill or intrinsic code quality.",
    },
  };
  await adminRequest("/rest/v1/repository_snapshots", env, {
    method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(snapshot),
  });
  await adminRequest("/rest/v1/repositories?id=eq." + encodeURIComponent(repository.id), env, {
    method: "PATCH", body: JSON.stringify({ full_name: repo.full_name, owner_login: repo.owner.login, name: repo.name, description: repo.description, visibility: repo.visibility, default_branch: repo.default_branch, is_archived: repo.archived, last_synced_at: new Date().toISOString() }),
  });
  await adminRequest("/rest/v1/analysis_runs?id=eq." + encodeURIComponent(job.analysisRunId), env, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed", score: score.score, score_breakdown: score.dimensions, findings: score.findings, completed_at: new Date().toISOString() }),
  });
  return { score: score.score, findings: score.findings.length };
}

export default {
  async fetch() {
    return Response.json({ service: "reposcope-analysis", status: "ready", engine: "0.1.0", scoring: "heuristic" });
  },
  async queue(batch, env) {
    const configured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY);
    for (const message of batch.messages) {
      const job = message.body;
      if (!configured) {
        console.error("Analysis Worker configuration is incomplete.");
        message.retry({ delaySeconds: 120 });
        continue;
      }
      const isAnalysisJob = job?.version === 1 && job.analysisRunId && job.repositoryId && job.installationId;
      const isWebhookJob = job?.version === 1 && job.deliveryId && job.eventType;
      if (!isAnalysisJob && !isWebhookJob) {
        console.error("Rejected malformed RepoScope queue message.");
        message.ack();
        continue;
      }
      try {
        const result = isAnalysisJob
          ? await processAnalysis(job, env)
          : await processWebhookEvent(job, env);
        console.log("RepoScope queue job completed", { analysisRunId: job.analysisRunId || null, deliveryId: job.deliveryId || null, ...result });
        message.ack();
      } catch (error) {
        console.error("RepoScope queue job failed", {
          analysisRunId: job.analysisRunId || null,
          deliveryId: job.deliveryId || null,
          status: error.status || null,
          message: error.message,
        });
        if ((error.retryable || !error.permanent) && message.attempts < 5) {
          message.retry({ delaySeconds: Math.min(300, 15 * message.attempts) });
        } else {
          try {
            if (job.analysisRunId) await adminRequest("/rest/v1/analysis_runs?id=eq." + encodeURIComponent(job.analysisRunId), env, {
              method: "PATCH",
              body: JSON.stringify({ status: "failed", error_code: error.permanent ? "ANALYSIS_INPUT_INVALID" : "ANALYSIS_FAILED", completed_at: new Date().toISOString() }),
            });
            if (job.deliveryId) await adminRequest("/rest/v1/webhook_deliveries?delivery_id=eq." + encodeURIComponent(job.deliveryId), env, { method: "PATCH", body: JSON.stringify({ processing_error: "EVENT_PROCESSING_FAILED" }) });
          } catch (updateError) {
            console.error("Could not mark analysis run failed", updateError.message);
          }
          message.ack();
        }
      }
    }
  },
};
