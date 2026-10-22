import { prisma } from "@/lib/db";
import { checkThrottle } from "@/lib/throttle";
import { scimBaseUrl } from "@/lib/sso/urls";
import {
  applyUserFields,
  authenticateScim,
  createGroup,
  createUser,
  deleteGroup,
  deleteUser,
  fieldsFromUser,
  fieldsFromUserPatch,
  groupResource,
  groupWhere,
  IDENTITY_SELECT,
  listResponse,
  logScim,
  paging,
  parseFilter,
  patchGroup,
  readOps,
  replaceGroup,
  SCHEMA,
  ScimError,
  scimError,
  scimJson,
  userResource,
  userWhere,
  type ScimConn,
} from "@/lib/sso/scim";

// SCIM 2.0 (docs/SSO.md): /api/scim/v2/{Users,Groups,ServiceProviderConfig,
// ResourceTypes,Schemas}. JumpCloud's custom SCIM connector is the first client.

export const dynamic = "force-dynamic";

const GROUP_SELECT = { id: true, displayName: true, externalId: true, createdAt: true, updatedAt: true } as const;

async function user(conn: ScimConn, id: string) {
  const row = await prisma.ssoIdentity.findFirst({ where: { id, connectionId: conn.id }, select: IDENTITY_SELECT });
  if (!row) throw new ScimError(404, "User not found.");
  return userResource(row);
}

async function group(conn: ScimConn, id: string, members = true) {
  const row = await prisma.idpGroup.findFirst({ where: { id, connectionId: conn.id }, select: GROUP_SELECT });
  if (!row) throw new ScimError(404, "Group not found.");
  return groupResource(conn.id, row, members);
}

function serviceProviderConfig() {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://github.com/32bitcolor/tavoro/blob/main/docs/SSO.md",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [{ type: "oauthbearertoken", name: "Bearer token", description: "The SCIM token from Tavoro's Settings → Single sign-on", primary: true }],
    meta: { resourceType: "ServiceProviderConfig", location: `${scimBaseUrl()}/ServiceProviderConfig` },
  };
}

function resourceTypes() {
  return listResponse(
    [
      { schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "User", name: "User", endpoint: "/Users", schema: SCHEMA.user, meta: { resourceType: "ResourceType", location: `${scimBaseUrl()}/ResourceTypes/User` } },
      { schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"], id: "Group", name: "Group", endpoint: "/Groups", schema: SCHEMA.group, meta: { resourceType: "ResourceType", location: `${scimBaseUrl()}/ResourceTypes/Group` } },
    ],
    2,
    1,
  );
}

function schemas() {
  const attr = (name: string, type = "string", extra: Record<string, unknown> = {}) => ({ name, type, multiValued: false, required: false, mutability: "readWrite", returned: "default", ...extra });
  return listResponse(
    [
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
        id: SCHEMA.user,
        name: "User",
        attributes: [
          attr("userName", "string", { required: true, uniqueness: "server" }),
          attr("name", "complex", { subAttributes: [attr("givenName"), attr("familyName"), attr("formatted")] }),
          attr("displayName"),
          attr("emails", "complex", { multiValued: true, subAttributes: [attr("value"), attr("type"), attr("primary", "boolean")] }),
          attr("active", "boolean"),
          attr("externalId"),
        ],
      },
      {
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Schema"],
        id: SCHEMA.group,
        name: "Group",
        attributes: [attr("displayName", "string", { required: true }), attr("members", "complex", { multiValued: true, subAttributes: [attr("value"), attr("display")] }), attr("externalId")],
      },
    ],
    2,
    1,
  );
}

async function route(conn: ScimConn, req: Request, segs: string[], body: unknown): Promise<{ res: Response; summary: string }> {
  const url = new URL(req.url);
  const [kind, id, extra] = segs;
  const m = req.method;
  if (extra) throw new ScimError(404, "Not found.");
  const obj = (body ?? {}) as Record<string, unknown>;

  if (kind === "ServiceProviderConfig" && m === "GET") return { res: scimJson(serviceProviderConfig()), summary: "service provider config" };
  if (kind === "ResourceTypes" && m === "GET") return { res: scimJson(resourceTypes()), summary: "resource types" };
  if (kind === "Schemas" && m === "GET") return { res: scimJson(schemas()), summary: "schemas" };

  if (kind === "Users") {
    if (!id && m === "GET") {
      const f = parseFilter(url.searchParams.get("filter"));
      const where = userWhere(conn.id, f);
      const { startIndex, count, skip } = paging(url);
      const [total, rows] = await Promise.all([prisma.ssoIdentity.count({ where }), prisma.ssoIdentity.findMany({ where, orderBy: { createdAt: "asc" }, skip, take: count, select: IDENTITY_SELECT })]);
      return { res: scimJson(listResponse(rows.map(userResource), total, startIndex)), summary: f ? `find user ${f.attr}=${f.value}: ${total}` : `list users: ${total}` };
    }
    if (!id && m === "POST") {
      const newId = await createUser(conn, obj);
      const r = await user(conn, newId);
      return { res: scimJson(r, 201, { location: r.meta.location }), summary: `created user ${r.userName}` };
    }
    if (id && m === "GET") {
      const r = await user(conn, id);
      return { res: scimJson(r), summary: `get user ${r.userName}` };
    }
    if (id && m === "PUT") {
      const f = fieldsFromUser(obj);
      await applyUserFields(conn, id, { ...f, active: f.active ?? true });
      const r = await user(conn, id);
      return { res: scimJson(r), summary: `replaced user ${r.userName}${r.active ? "" : " (inactive)"}` };
    }
    if (id && m === "PATCH") {
      const f = fieldsFromUserPatch(readOps(body));
      await applyUserFields(conn, id, f);
      const r = await user(conn, id);
      const what = Object.keys(f).filter((k) => f[k as keyof typeof f] !== undefined).join(", ") || "nothing Tavoro keeps";
      return { res: scimJson(r), summary: `updated user ${r.userName}: ${what}${f.active === false ? " → deactivated" : f.active ? " → active" : ""}` };
    }
    if (id && m === "DELETE") {
      const r = await user(conn, id);
      await deleteUser(conn, id);
      return { res: scimJson(null, 204), summary: `deleted user ${r.userName} (suspended in Tavoro)` };
    }
  }

  if (kind === "Groups") {
    const withMembers = !/\bmembers\b/i.test(url.searchParams.get("excludedAttributes") ?? "");
    if (!id && m === "GET") {
      const f = parseFilter(url.searchParams.get("filter"));
      const where = groupWhere(conn.id, f);
      const { startIndex, count, skip } = paging(url);
      const [total, rows] = await Promise.all([prisma.idpGroup.count({ where }), prisma.idpGroup.findMany({ where, orderBy: { createdAt: "asc" }, skip, take: count, select: GROUP_SELECT })]);
      const items = await Promise.all(rows.map((g) => groupResource(conn.id, g, withMembers)));
      return { res: scimJson(listResponse(items, total, startIndex)), summary: f ? `find group ${f.attr}=${f.value}: ${total}` : `list groups: ${total}` };
    }
    if (!id && m === "POST") {
      const newId = await createGroup(conn, obj);
      const r = await group(conn, newId);
      return { res: scimJson(r, 201, { location: r.meta.location }), summary: `created group ${r.displayName} (${r.members?.length ?? 0} members)` };
    }
    if (id && m === "GET") {
      const r = await group(conn, id, withMembers);
      return { res: scimJson(r), summary: `get group ${r.displayName}` };
    }
    if (id && m === "PUT") {
      await replaceGroup(conn, id, obj);
      const r = await group(conn, id);
      return { res: scimJson(r), summary: `replaced group ${r.displayName} (${r.members?.length ?? 0} members)` };
    }
    if (id && m === "PATCH") {
      const ops = readOps(body);
      await patchGroup(conn, id, ops);
      const r = await group(conn, id);
      return { res: scimJson(r), summary: `updated group ${r.displayName}: ${ops.map((o) => `${o.op} ${o.path ?? ""}`.trim()).join(", ")} (${r.members?.length ?? 0} members)` };
    }
    if (id && m === "DELETE") {
      const r = await group(conn, id, false);
      await deleteGroup(conn, id);
      return { res: scimJson(null, 204), summary: `deleted group ${r.displayName}` };
    }
  }
  throw new ScimError(404, `No ${m} ${kind ?? ""} here.`);
}

async function handle(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const conn = await authenticateScim(req);
  if (!conn) return scimJson({ schemas: [SCHEMA.error], status: "401", detail: "A valid SCIM token is required." }, 401, { "www-authenticate": 'Bearer realm="tavoro-scim"' });
  if (!(await checkThrottle(`scim:${conn.id}`, 1200, 60))) return scimJson({ schemas: [SCHEMA.error], status: "429", detail: "Too many requests." }, 429);
  const segs = (await params).path;
  const url = new URL(req.url);
  const path = `/${segs.join("/")}${url.search}`;
  let body: unknown;
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
    const text = await req.text();
    if (text.length > 1_000_000) return scimError(new ScimError(413, "Request too large."));
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      await logScim(conn.id, { method: req.method, path, status: 400, summary: "body isn't JSON" });
      return scimError(new ScimError(400, "The body isn't valid JSON.", "invalidSyntax"));
    }
  }
  let res: Response;
  let summary: string;
  try {
    ({ res, summary } = await route(conn, req, segs, body));
  } catch (e) {
    res = scimError(e);
    summary = e instanceof Error ? e.message : "error";
  }
  // Discovery calls are noise in the log; everything else is worth seeing.
  if (!["ServiceProviderConfig", "ResourceTypes", "Schemas"].includes(segs[0])) {
    await logScim(conn.id, { method: req.method, path, status: res.status, summary, body });
  }
  return res;
}

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
