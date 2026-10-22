import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { baseUrl } from "@/lib/oauth";
import { getConnection, isReady } from "@/lib/sso/connection";
import { firstUse, readProfile, samlFor } from "@/lib/sso/saml";
import { fullName, ProvisionError, recomputeRoles, replaceGroupsFromAssertion, upsertMember } from "@/lib/sso/provision";

// The Assertion Consumer Service: the identity provider POSTs the signed response
// here, for both SP-initiated and IdP-initiated sign-in (docs/SSO.md).

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const base = baseUrl(req);
  const fail = (code: string) => Response.redirect(`${base}/login?sso=${code}`, 303);
  const conn = await getConnection((await params).id);
  if (!conn || !isReady(conn)) return fail("unavailable");

  const form = await req.formData().catch(() => null);
  const samlResponse = form?.get("SAMLResponse");
  if (typeof samlResponse !== "string" || samlResponse.length > 500_000) return fail("invalid");
  const relay = form?.get("RelayState");

  let profile;
  try {
    const result = await samlFor(conn).validatePostResponseAsync({ SAMLResponse: samlResponse });
    profile = result.profile;
  } catch (e) {
    console.warn(`[sso] ${conn.id}: rejected SAML response:`, e instanceof Error ? e.message : e);
    return fail("invalid");
  }
  if (!profile || !(await firstUse(profile))) return fail("invalid");

  const { email, given, family, groups: asserted } = readProfile(profile, conn.groupAttribute);
  // No group attribute: with SCIM on, SCIM owns group membership, so leave it be. With
  // SCIM off and roles from groups on, it means "no groups" (IdPs leave the attribute
  // out rather than send it empty), or a removed admin would stay one.
  const groups = asserted ?? (conn.manageRoles && !conn.scimEnabled ? [] : null);
  if (!email) return fail("noemail");

  // Known here already, or allowed to be created on first sign-in?
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } });
  const member = user
    ? await prisma.membership.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId: conn.workspaceId } }, select: { suspendedAt: true } })
    : null;
  if (member?.suspendedAt) return fail("suspended");
  if (!member && !conn.jitProvisioning) return fail("notprovisioned");

  let userId: string;
  try {
    ({ userId } = await upsertMember(conn, { email, name: fullName(given, family) }));
    if (groups) {
      await replaceGroupsFromAssertion(conn, userId, groups);
      await recomputeRoles(conn, [userId]);
    }
  } catch (e) {
    console.warn(`[sso] ${conn.id}: provisioning ${email} failed:`, e instanceof ProvisionError ? e.message : e);
    return fail("invalid");
  }
  await prisma.ssoConnection.update({ where: { id: conn.id }, data: { lastLoginAt: new Date() } });
  await createSession(userId, conn.workspaceId, { sso: true });
  const next = typeof relay === "string" && relay.startsWith("/") && !relay.startsWith("//") ? relay : "/dashboard";
  return Response.redirect(`${base}${next}`, 303);
}
