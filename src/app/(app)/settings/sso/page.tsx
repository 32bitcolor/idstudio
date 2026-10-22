import { X509Certificate } from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveMembership } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";
import { ensureConnection } from "@/lib/sso/connection";
import { scimBaseUrl, ssoUrls } from "@/lib/sso/urls";
import { SsoSettings } from "@/components/settings/sso-settings";

export const metadata = { title: "Single sign-on · Tavoro" };

export default async function SsoSettingsPage() {
  const membership = await getActiveMembership();
  if (!membership || membership.role !== Role.ADMIN) redirect("/settings/account");
  const { id } = await ensureConnection(membership.workspaceId);
  const conn = await prisma.ssoConnection.findUniqueOrThrow({
    where: { id },
    select: {
      id: true,
      enabled: true,
      idpEntityId: true,
      idpSsoUrl: true,
      idpCert: true,
      domains: true,
      groupAttribute: true,
      jitProvisioning: true,
      requireSso: true,
      manageRoles: true,
      defaultRole: true,
      scimEnabled: true,
      scimTokenHint: true,
      lastScimAt: true,
      lastLoginAt: true,
      roleMappings: { orderBy: { groupName: "asc" }, select: { groupName: true, role: true } },
      groups: { orderBy: { displayName: "asc" }, select: { displayName: true, fromScim: true, _count: { select: { members: true } } } },
      _count: { select: { identities: true } },
      scimLogs: { orderBy: { createdAt: "desc" }, take: 40, select: { id: true, method: true, path: true, status: true, summary: true, request: true, createdAt: true } },
    },
  });
  const certExpiry = conn.idpCert ? certNotAfter(conn.idpCert) : null;
  const { idpCert, ...rest } = conn;
  return (
    <SsoSettings
      urls={{ ...ssoUrls(conn.id), scim: scimBaseUrl() }}
      conn={{
        ...rest,
        hasCert: !!idpCert,
        certExpiry,
        certExpiringSoon: expiresWithin(certExpiry, 30),
        lastScimAt: conn.lastScimAt?.toISOString() ?? null,
        lastLoginAt: conn.lastLoginAt?.toISOString() ?? null,
        identities: conn._count.identities,
        groups: conn.groups.map((g) => ({ name: g.displayName, fromScim: g.fromScim, members: g._count.members })),
        scimLogs: conn.scimLogs.map((l) => ({ ...l, request: l.request ? JSON.stringify(l.request, null, 2) : null, createdAt: l.createdAt.toISOString() })),
      }}
    />
  );
}

/** When the (first) signing certificate expires, so the page can warn ahead of a rollover. */
function certNotAfter(pem: string): string | null {
  try {
    const first = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/)?.[0];
    return first ? new Date(new X509Certificate(first).validTo).toISOString() : null;
  } catch {
    return null;
  }
}

function expiresWithin(iso: string | null, days: number): boolean {
  return !!iso && new Date(iso).getTime() - Date.now() < days * 864e5;
}
