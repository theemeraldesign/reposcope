const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = env.APP_ORIGIN || "*";
  return {
    "access-control-allow-origin": allowed === "*" ? "*" : origin === allowed ? allowed : "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

function bearer(request) {
  const value = request.headers.get("Authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

async function getUser(token, env) {
  const response = await fetch(new URL("/auth/v1/user", env.SUPABASE_URL), {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return await response.json();
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        service: "reposcope-api",
        status: "ok",
        configured: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
        integrations: { githubApp: "pending-credentials" },
      }, 200, cors);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
      return json({ error: "API_CONFIGURATION_MISSING" }, 503, cors);
    }

    if (request.method === "GET" && url.pathname === "/v1/me") {
      const token = bearer(request);
      if (!token) return json({ error: "AUTHENTICATION_REQUIRED" }, 401, cors);
      const user = await getUser(token, env);
      if (!user) return json({ error: "INVALID_OR_EXPIRED_SESSION" }, 401, cors);
      return json({ user: { id: user.id, email: user.email ?? null } }, 200, cors);
    }

    if (request.method === "GET" && url.pathname === "/v1/repositories") {
      const token = bearer(request);
      if (!token) return json({ error: "AUTHENTICATION_REQUIRED" }, 401, cors);
      const user = await getUser(token, env);
      if (!user) return json({ error: "INVALID_OR_EXPIRED_SESSION" }, 401, cors);
      const endpoint = new URL("/rest/v1/repositories", env.SUPABASE_URL);
      endpoint.searchParams.set("select", "id,full_name,description,visibility,default_branch,is_archived,last_synced_at,updated_at");
      endpoint.searchParams.set("order", "updated_at.desc");
      const response = await fetch(endpoint, {
        headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${token}` },
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: { ...cors, "content-type": response.headers.get("content-type") || "application/json" },
      });
    }

    if (request.method === "GET" && url.pathname.startsWith("/auth/github/")) {
      return json({ error: "GITHUB_APP_NOT_CONFIGURED", message: "Complete the GitHub App setup before connecting repositories." }, 503, cors);
    }

    if (request.method === "POST" && url.pathname === "/webhooks/github") {
      return json({ error: "WEBHOOK_NOT_CONFIGURED" }, 503, cors);
    }

    return json({ error: "NOT_FOUND" }, 404, cors);
  },
};
