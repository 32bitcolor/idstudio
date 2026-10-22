import "server-only";
import { createHash } from "node:crypto";
import { SAML, ValidateInResponseTo, type CacheProvider, type Profile } from "@node-saml/node-saml";
import { redis } from "@/lib/redis";
import { ssoUrls } from "@/lib/sso/urls";
import { splitPem } from "@/lib/sso/metadata";

// SAML 2.0 service provider (docs/SSO.md), on @node-saml/node-saml for the XML
// signature work. Requests aren't signed (JumpCloud doesn't need it). Responses must be
// signed by the configured certificate: the whole response (JumpCloud's default) or the
// assertion (Okta's, Entra's); node-saml checks the signature covers what it reads.
// IdP-initiated sign-in (the app tile in JumpCloud's portal) is allowed: InResponseTo
// is checked when present, against request ids held in Redis rather than a cookie,
// since the IdP's POST back is cross-site and a Lax cookie wouldn't come along.

const REQUEST_TTL_S = 10 * 60;

const cache: CacheProvider = {
  async saveAsync(key, value) {
    await redis.set(`saml:req:${key}`, value, "EX", REQUEST_TTL_S);
    return { value, createdAt: Date.now() };
  },
  async getAsync(key) {
    return redis.get(`saml:req:${key}`);
  },
  async removeAsync(key) {
    if (!key) return null;
    const v = await redis.get(`saml:req:${key}`);
    await redis.del(`saml:req:${key}`);
    return v;
  },
};

export type SamlConn = { id: string; idpEntityId: string | null; idpSsoUrl: string | null; idpCert: string | null };

export function samlFor(conn: SamlConn): SAML {
  const urls = ssoUrls(conn.id);
  return new SAML({
    issuer: urls.entityId,
    audience: urls.entityId,
    callbackUrl: urls.acs,
    entryPoint: conn.idpSsoUrl ?? undefined,
    idpIssuer: conn.idpEntityId ?? undefined,
    idpCert: conn.idpCert ? splitPem(conn.idpCert) : "missing",
    identifierFormat: null, // JumpCloud chooses the NameID; we read the email from it or an attribute
    disableRequestedAuthnContext: true,
    // Both false = either one must carry a valid signature (never neither).
    wantAssertionsSigned: false,
    wantAuthnResponseSigned: false,
    acceptedClockSkewMs: 60_000,
    validateInResponseTo: ValidateInResponseTo.ifPresent,
    requestIdExpirationPeriodMs: REQUEST_TTL_S * 1000,
    cacheProvider: cache,
  });
}

/** Each assertion is accepted once: a captured response can't be posted again. */
export async function firstUse(profile: Profile): Promise<boolean> {
  const xml = profile.getAssertionXml?.() ?? JSON.stringify(profile);
  const key = `saml:seen:${createHash("sha256").update(xml).digest("hex")}`;
  try {
    return (await redis.set(key, "1", "EX", 60 * 60, "NX")) === "OK";
  } catch {
    return true; // Redis down: signature, audience and time checks still apply
  }
}

const EMAIL_ATTRS = ["email", "mail", "Email", "emailAddress", "urn:oid:0.9.2342.19200300.100.1.3", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
const FIRST_ATTRS = ["firstname", "firstName", "givenName", "given_name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"];
const LAST_ATTRS = ["lastname", "lastName", "sn", "surname", "family_name", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"];

function first(profile: Profile, names: string[]): string | null {
  for (const n of names) {
    const v = profile[n];
    const s = Array.isArray(v) ? v[0] : v;
    if (typeof s === "string" && s.trim()) return s.trim();
  }
  return null;
}

/** Email, name and groups from a validated assertion. */
export function readProfile(profile: Profile, groupAttribute: string) {
  const email = first(profile, EMAIL_ATTRS) ?? (/@/.test(profile.nameID ?? "") ? profile.nameID : null);
  const raw = profile[groupAttribute];
  const groups = raw === undefined ? null : (Array.isArray(raw) ? raw : [raw]).filter((g): g is string => typeof g === "string");
  return { email, given: first(profile, FIRST_ATTRS), family: first(profile, LAST_ATTRS), groups };
}
