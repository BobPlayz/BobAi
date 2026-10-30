import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db, integrations, oauthStates } from "@bobai/db";
const TTL_MS = 10 * 60_000; const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function key() { const raw = process.env.BOBAI_CREDENTIAL_ENCRYPTION_KEY?.trim() || ""; const value = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64"); if (value.length !== 32) throw new Error("credential encryption key must be 32 bytes"); return value; }
function encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv); const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]); return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`; }
function decrypt(value: string) { const [version, ivRaw, tagRaw, dataRaw] = value.split("."); if (version !== "v1" || !ivRaw || !tagRaw || !dataRaw) throw new Error("invalid encrypted credential"); const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url")); decipher.setAuthTag(Buffer.from(tagRaw, "base64url")); return Buffer.concat([decipher.update(Buffer.from(dataRaw, "base64url")), decipher.final()]).toString("utf8"); }
export type OAuthProviderConfig = { authorizationUrl: string; tokenUrl: string; clientId: string; clientSecret?: string; scopes?: string[]; authParams?: Record<string, string> };
function config(provider: string): OAuthProviderConfig {
  let raw: unknown;
  try { raw = JSON.parse(process.env.BOBAI_OAUTH_PROVIDERS || "{}"); } catch { throw new Error("invalid OAuth provider configuration"); }
  const custom = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[provider] : undefined;
  const env = (name: string) => process.env[name]?.trim() || "";
  const presets: Record<string, OAuthProviderConfig> = {
    google: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth", tokenUrl: "https://oauth2.googleapis.com/token", clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET") || undefined, scopes: ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/drive.file"], authParams: { access_type: "offline", prompt: "consent" } },
    microsoft: { authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token", clientId: env("MICROSOFT_CLIENT_ID"), clientSecret: env("MICROSOFT_CLIENT_SECRET") || undefined, scopes: ["openid", "profile", "email", "offline_access", "User.Read", "Mail.Read", "Mail.Send", "Files.ReadWrite.All", "Sites.ReadWrite.All"], authParams: { prompt: "select_account" } },
  };
  const preset = presets[provider];
  if (!custom && !preset) throw new Error("OAuth provider is not configured");
  const v = (custom && typeof custom === "object" ? custom : preset) as Record<string, unknown>;
  const authorizationUrl = typeof v.authorizationUrl === "string" ? v.authorizationUrl : "";
  const tokenUrl = typeof v.tokenUrl === "string" ? v.tokenUrl : "";
  const clientId = typeof v.clientId === "string" ? v.clientId : "";
  if (!authorizationUrl || !tokenUrl || !clientId) throw new Error(provider + " OAuth is not configured. Add its client ID and secret in deployment settings.");
  for (const rawUrl of [authorizationUrl, tokenUrl]) if (new URL(rawUrl).protocol !== "https:") throw new Error("OAuth endpoints must use HTTPS");
  const authParams = v.authParams && typeof v.authParams === "object" ? Object.fromEntries(Object.entries(v.authParams as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : undefined;
  return { authorizationUrl, tokenUrl, clientId, clientSecret: typeof v.clientSecret === "string" ? v.clientSecret : undefined, scopes: Array.isArray(v.scopes) ? v.scopes.filter((x): x is string => typeof x === "string").slice(0, 50) : [], authParams };
}
export async function beginOAuth(provider: string, userId: string, workspaceId: string, redirectUri: string) { const cfg = config(provider); const redirect = new URL(redirectUri); if (redirect.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(redirect.hostname.toLowerCase()))) throw new Error("OAuth redirect URI must use HTTPS outside local development"); const state = randomBytes(32).toString("base64url"); const verifier = randomBytes(32).toString("base64url"); const challenge = createHash("sha256").update(verifier).digest("base64url"); await db.insert(oauthStates).values({ userId, workspaceId, provider, stateHash: hash(state), codeVerifierHash: encrypt(verifier), redirectUri, expiresAt: new Date(Date.now() + TTL_MS) }); const url = new URL(cfg.authorizationUrl); url.searchParams.set("client_id", cfg.clientId); url.searchParams.set("redirect_uri", redirectUri); url.searchParams.set("response_type", "code"); url.searchParams.set("state", state); url.searchParams.set("code_challenge", challenge); url.searchParams.set("code_challenge_method", "S256"); if (cfg.scopes?.length) url.searchParams.set("scope", cfg.scopes.join(" ")); for (const [name, value] of Object.entries(cfg.authParams || {})) url.searchParams.set(name, value); return { url: url.toString(), expiresIn: TTL_MS / 1000 }; }
export async function completeOAuth(provider: string, code: string, state: string, userId: string, workspaceId: string) { if (!code || code.length > 8_000) throw new Error("invalid OAuth code"); if (!state || state.length > 256) throw new Error("invalid OAuth state"); const now = new Date(); const [row] = await db.update(oauthStates).set({ consumedAt: now }).where(and(eq(oauthStates.stateHash, hash(state)), eq(oauthStates.userId, userId), eq(oauthStates.workspaceId, workspaceId), eq(oauthStates.provider, provider), isNull(oauthStates.consumedAt), gt(oauthStates.expiresAt, now))).returning({ id: oauthStates.id, redirectUri: oauthStates.redirectUri, codeVerifierHash: oauthStates.codeVerifierHash }); if (!row) throw new Error("OAuth state is invalid or expired"); const cfg = config(provider); const verifier = row.codeVerifierHash ? decrypt(row.codeVerifierHash) : ""; const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: row.redirectUri, client_id: cfg.clientId, code_verifier: verifier }); if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret); const response = await fetch(cfg.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body, redirect: "error", signal: AbortSignal.timeout(15_000) }); const text = await response.text(); if (text.length > 1_000_000 || !response.ok) throw new Error("OAuth token exchange failed"); let token: unknown; try { token = JSON.parse(text); } catch { throw new Error("OAuth token response was invalid"); } if (!token || typeof token !== "object" || typeof (token as Record<string, unknown>).access_token !== "string") throw new Error("OAuth provider returned no access token"); const safe = token as Record<string, unknown>; const credentials = encrypt(JSON.stringify({ access_token: safe.access_token, refresh_token: typeof safe.refresh_token === "string" ? safe.refresh_token : undefined, token_type: typeof safe.token_type === "string" ? safe.token_type : undefined, expires_in: typeof safe.expires_in === "number" ? safe.expires_in : undefined, obtained_at: now.toISOString() })); const [integration] = await db.insert(integrations).values({ workspaceId, createdBy: userId, provider, displayName: provider, encryptedCredentials: credentials, scopes: cfg.scopes || [], configuration: { oauth: true }, isEnabled: true }).returning({ id: integrations.id, provider: integrations.provider, displayName: integrations.displayName }); return integration; }
export async function cleanupOAuthStates() { await db.delete(oauthStates).where(lt(oauthStates.expiresAt, new Date())); }

export async function getConnectedAccessToken(provider: string, userId: string, workspaceId: string): Promise<string> {
  const [row] = await db.select({ id: integrations.id, encryptedCredentials: integrations.encryptedCredentials }).from(integrations).where(and(eq(integrations.provider, provider), eq(integrations.createdBy, userId), eq(integrations.workspaceId, workspaceId), eq(integrations.isEnabled, true), isNull(integrations.deletedAt))).orderBy(integrations.createdAt).limit(1);
  if (!row?.encryptedCredentials) throw new Error("Connect " + provider + " in Connected apps first.");
  let credentials: Record<string, unknown>;
  try { credentials = JSON.parse(decrypt(row.encryptedCredentials)) as Record<string, unknown>; } catch { throw new Error("Connected app credentials could not be read securely."); }
  const access = typeof credentials.access_token === "string" ? credentials.access_token : "";
  const obtained = typeof credentials.obtained_at === "string" ? Date.parse(credentials.obtained_at) : 0;
  const expiresIn = typeof credentials.expires_in === "number" ? credentials.expires_in : 0;
  if (access && (!expiresIn || Date.now() < obtained + expiresIn * 1000 - 60_000)) return access;
  const refreshToken = typeof credentials.refresh_token === "string" ? credentials.refresh_token : "";
  if (!refreshToken) throw new Error("The " + provider + " connection expired. Disconnect it and connect again.");
  const cfg = config(provider);
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: cfg.clientId });
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);
  if (cfg.scopes?.length) body.set("scope", cfg.scopes.join(" "));
  const response = await fetch(cfg.tokenUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body, redirect: "error", signal: AbortSignal.timeout(15_000) });
  const raw = await response.text();
  if (!response.ok || raw.length > 1_000_000) throw new Error("Could not refresh the " + provider + " connection. Reconnect it in Connected apps.");
  const token = JSON.parse(raw) as Record<string, unknown>;
  if (typeof token.access_token !== "string") throw new Error("The " + provider + " refresh response was invalid.");
  const next = { ...credentials, access_token: token.access_token, refresh_token: typeof token.refresh_token === "string" ? token.refresh_token : refreshToken, expires_in: typeof token.expires_in === "number" ? token.expires_in : credentials.expires_in, obtained_at: new Date().toISOString() };
  await db.update(integrations).set({ encryptedCredentials: encrypt(JSON.stringify(next)), updatedAt: new Date() }).where(eq(integrations.id, row.id));
  return token.access_token;
}
