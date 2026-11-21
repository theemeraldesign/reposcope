const encoder = new TextEncoder();

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
    "access-control-allow-headers": "Authorization, Content-Type, X-GitHub-Delivery, X-GitHub-Event, X-Hub-Signature-256",
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

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i += 1) result |= left[i] ^ right[i];
  return result === 0;
}

async function createState(userId, secret) {
  const payload = base64Url(encoder.encode(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 600, nonce: crypto.randomUUID() })));
  const signature = base64Url(await hmac(payload, secret));
  return `${payload}.${signature}`;
}

async function verifyState(state, secret) {
  const [payload, signature, extra] = state.split(".");
  if (!payload || !signature || extra) return null;
  const expected = await hmac(payload, secret);
  if (!constantTimeEqual(expected, decodeBase64Url(signature))) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

function pkcs1ToPkcs8(pem) {
  const body = pem.replace(/-----BEGIN RSA PRIVATE KEY-----|-----END RSA PRIVATE KEY-----|\s/g, "");
  const pkcs1 = decodeBase64Url(body.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""));
  const length = pkcs1.length;
  if (length > 65535) throw new Error("GitHub private key is too large");
  const prefix = new Uint8Array([
    0x30, 0x82, ((length + 20) >> 8) & 255, (length + 20) & 255,
    0x02, 0x01, 0x00,
    0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    0x04, 0x82, (length >> 8) & 255, length & 255,
  ]);
  const output = new Uint8Array(prefix.length + pkcs1.length);
  output.set(prefix);
  output.set(pkcs1, prefix.length);
  return output;
}

async function createAppJwt(env) {
  const pem = env.GITHUB_PRIVATE_KEY;
  const keyBytes = pem.includes("BEGIN RSA PRIVATE KEY")
    ? pkcs1ToPkcs8(pem)
    : decodeBase64Url(pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(encoder.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.GITHUB_APP_ID })));
  const unsigned = `${header}.${payload}`;
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(unsigned)));
  return `${unsigned}.${base64Url(signature)}`;
}

async function supabaseAdmin(path, env, options = {}) {
  const response = await fetch(new URL(path, env.SUPABASE_URL), {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  return response;
}

async function handleInstall(request, env, cors) {
  if (!env.GITHUB_APP_SLUG || !env.GITHUB_STATE_SECRET) {
    return json({ error: "GITHUB_APP_CONFIGURATION_MISSING" }, 503, cors);
  }
  const token = bearer(request);
  if (!token) return json({ error: "AUTHENTICATION_REQUIRED" }, 401, cors);
  const user = await getUser(token, env);
  if (!user) return json({ error: "INVALID_OR_EXPIRED_SESSION" }, 401, cors);
  const state = await createState(user.id, env.GITHUB_STATE_SECRET);
  const target = new URL(`https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG)}/installations/new`);
  target.searchParams.set("state", state);
  return Response.redirect(target.toString(), 302);
}

async function handleSetup(request, env, cors) {
  const url = new URL(request.url);
  const installationId = Number(url.searchParams.get("installation_id"));
  const state = url.searchParams.get("state") || "";
  if (!Number.isSafeInteger(installationId) || installationId <= 0) return json({ error: "INVALID_INSTALLATION_ID" }, 400, cors);
  if (!env.GITHUB_STATE_SECRET || !env.GITHUB_APP_ID || !env.GITHUB_PRIVATE_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "GITHUB_INSTALLATION_CONFIGURATION_MISSING" }, 503, cors);
  }
  const stateData = await verifyState(state, env.GITHUB_STATE_SECRET);
  if (!stateData) return json({ error: "INVALID_OR_EXPIRED_STATE" }, 400, cors);

  const appJwt = await createAppJwt(env);
  const installationResponse = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${appJwt}`,
      "x-github-api-version": "2022-11-28",
      "user-agent": "RepoScope",
    },
  });
  if (!installationResponse.ok) return json({ error: "GITHUB_INSTALLATION_LOOKUP_FAILED" }, 502, cors);
  const installation = await installationResponse.json();
  const accountLogin = installation.account?.login;
  const accountType = installation.account?.type;
  if (!accountLogin || !["User", "Organization"].includes(accountType)) {
    return json({ error: "GITHUB_INSTALLATION_ACCOUNT_INVALID" }, 502, cors);
  }

  const saved = await supabaseAdmin("/rest/v1/github_installations?on_conflict=installation_id", env, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      user_id: stateData.sub,
      installation_id: installationId,
      account_login: accountLogin,
      account_type: accountType,
    }),
  });
  if (!saved.ok) {
    console.error("Could not persist GitHub installation", saved.status, await saved.text());
    return json({ error: "INSTALLATION_SAVE_FAILED" }, 502, cors);
  }
  const destination = env.APP_ORIGIN && env.APP_ORIGIN !== "*" ? new URL("/?github=connected", env.APP_ORIGIN).toString() : null;
  return destination ? Response.redirect(destination, 302) : json({ connected: true, account: accountLogin }, 200, cors);
}

async function verifyWebhook(body, signature, secret) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = await hmac(body, secret);
  const suppliedHex = signature.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(suppliedHex)) return false;
  const supplied = Uint8Array.from(suppliedHex.match(/.{2}/g), (byte) => parseInt(byte, 16));
  return constantTimeEqual(expected, supplied);
}

async function handleWebhook(request, env, cors) {
  if (!env.GITHUB_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: "WEBHOOK_CONFIGURATION_MISSING" }, 503, cors);
  }
  const body = await request.text();
  if (!(await verifyWebhook(body, request.headers.get("X-Hub-Signature-256"), env.GITHUB_WEBHOOK_SECRET))) {
    return json({ error: "INVALID_WEBHOOK_SIGNATURE" }, 401, cors);
  }
  const deliveryId = request.headers.get("X-GitHub-Delivery");
  const eventType = request.headers.get("X-GitHub-Event");
  if (!deliveryId || !eventType) return json({ error: "WEBHOOK_HEADERS_MISSING" }, 400, cors);
  let payload;
  try { payload = JSON.parse(body); } catch { return json({ error: "INVALID_WEBHOOK_JSON" }, 400, cors); }

  const saved = await supabaseAdmin("/rest/v1/webhook_deliveries?on_conflict=delivery_id", env, {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      delivery_id: deliveryId,
      event_type: eventType,
      installation_id: payload.installation?.id ?? null,
      payload,
    }),
  });
  if (!saved.ok) return json({ error: "WEBHOOK_PERSISTENCE_FAILED" }, 502, cors);

  if (env.EVENTS_QUEUE) {
    await env.EVENTS_QUEUE.send({ version: 1, deliveryId, eventType, installationId: payload.installation?.id ?? null });
  }
  return json({ accepted: true }, 202, cors);
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
        integrations: {
          githubApp: Boolean(env.GITHUB_APP_SLUG && env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY),
          webhook: Boolean(env.GITHUB_WEBHOOK_SECRET),
          eventQueue: Boolean(env.EVENTS_QUEUE),
        },
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

    if (request.method === "GET" && url.pathname === "/auth/github/install") return handleInstall(request, env, cors);
    if (request.method === "GET" && url.pathname === "/auth/github/setup") return handleSetup(request, env, cors);
    if (request.method === "POST" && url.pathname === "/webhooks/github") return handleWebhook(request, env, cors);

    return json({ error: "NOT_FOUND" }, 404, cors);
  },
};
