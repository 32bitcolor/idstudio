"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Copy, KeyRound, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/shared/page";
import { createScimToken, saveIdentityProvider, saveRoleMappings, saveSsoOptions, setScimEnabled } from "@/app/actions/sso";
import { cn } from "@/lib/utils";

// Settings → Single sign-on (docs/SSO.md). Written for any SAML 2.0 / SCIM 2.0
// identity provider; JumpCloud's field names appear as hints.

type RoleName = "ADMIN" | "MANAGER" | "MEMBER";
type Conn = {
  id: string;
  enabled: boolean;
  idpEntityId: string | null;
  idpSsoUrl: string | null;
  hasCert: boolean;
  certExpiry: string | null;
  certExpiringSoon: boolean;
  domains: string[];
  groupAttribute: string;
  jitProvisioning: boolean;
  requireSso: boolean;
  manageRoles: boolean;
  defaultRole: RoleName;
  scimEnabled: boolean;
  scimTokenHint: string | null;
  lastScimAt: string | null;
  lastLoginAt: string | null;
  identities: number;
  roleMappings: { groupName: string; role: RoleName }[];
  groups: { name: string; fromScim: boolean; members: number }[];
  scimLogs: { id: string; method: string; path: string; status: number; summary: string; request: string | null; createdAt: string }[];
};
type Urls = { entityId: string; acs: string; login: string; metadata: string; scim: string };

const ROLE_LABEL: Record<RoleName, string> = { ADMIN: "Admin", MANAGER: "Manager", MEMBER: "Member" };

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function CopyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
        {hint && <span className="font-normal"> · {hint}</span>}
      </span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-xs">{value}</code>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          title={`Copy ${label}`}
          onClick={() =>
            void navigator.clipboard.writeText(value).then(() => {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            })
          }
        >
          {done ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

function Card({ step, title, children, done }: { step: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="rounded-xl border border-border p-5">
      <h3 className="mb-3 flex items-center gap-2 font-medium">
        <span className={cn("flex size-6 items-center justify-center rounded-full text-xs", done ? "bg-success text-white" : "bg-muted text-muted-foreground")}>
          {done ? <Check className="size-3.5" /> : step}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Status({ msg }: { msg: { ok?: string; error?: string } | null }) {
  if (!msg) return null;
  return <p className={cn("text-sm", msg.error ? "text-destructive" : "text-success-ink")}>{msg.error ?? msg.ok}</p>;
}

export function SsoSettings({ conn, urls }: { conn: Conn; urls: Urls }) {
  const [pending, start] = useTransition();
  const configured = !!conn.idpSsoUrl && conn.hasCert;

  // Identity provider
  const [manual, setManual] = useState(false);
  const [xml, setXml] = useState("");
  const [idp, setIdp] = useState({ entityId: conn.idpEntityId ?? "", ssoUrl: conn.idpSsoUrl ?? "", cert: "" });
  const [idpMsg, setIdpMsg] = useState<{ ok?: string; error?: string } | null>(null);

  // Options
  const [opts, setOpts] = useState({
    enabled: conn.enabled,
    domains: conn.domains.join(", "),
    groupAttribute: conn.groupAttribute,
    jitProvisioning: conn.jitProvisioning,
    requireSso: conn.requireSso,
  });
  const [optMsg, setOptMsg] = useState<{ ok?: string; error?: string } | null>(null);

  // SCIM
  const [token, setToken] = useState<string | null>(null);
  const [scimMsg, setScimMsg] = useState<{ ok?: string; error?: string } | null>(null);

  // Roles
  const [manageRoles, setManageRoles] = useState(conn.manageRoles);
  const [defaultRole, setDefaultRole] = useState<RoleName>(conn.defaultRole);
  const [rows, setRows] = useState(conn.roleMappings.length ? conn.roleMappings : [{ groupName: "", role: "ADMIN" as RoleName }]);
  const [roleMsg, setRoleMsg] = useState<{ ok?: string; error?: string } | null>(null);

  const certSoon = conn.certExpiringSoon;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-surface p-4 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <ShieldCheck className={cn("size-4", conn.enabled ? "text-success" : "text-muted-foreground")} />
          Single sign-on is {conn.enabled ? "on" : "off"}
          {conn.requireSso && " and required"}
        </span>
        <span className="text-muted-foreground">Provisioning (SCIM) {conn.scimEnabled ? "on" : "off"}</span>
        <span className="text-muted-foreground">{conn.identities} linked members</span>
        <span className="text-muted-foreground">Last sign-in {when(conn.lastLoginAt)}</span>
        <span className="text-muted-foreground">Last SCIM request {when(conn.lastScimAt)}</span>
        <Link href="/help/sso" className="ml-auto text-primary underline">
          Setup guide
        </Link>
      </div>

      <Card step={1} title="Add Tavoro to your identity provider">
        <p className="mb-3 text-sm text-muted-foreground">
          Create a custom <strong className="text-foreground">SAML 2.0</strong> application in your identity provider (in JumpCloud: SSO Applications → Add New
          Application → Custom Application, with SSO and Identity Management) and give it these values.
        </p>
        <div className="flex flex-col gap-3">
          <CopyField label="ACS URL" hint="Assertion Consumer Service / Reply URL" value={urls.acs} />
          <CopyField label="SP Entity ID" hint="Audience / Identifier" value={urls.entityId} />
          <CopyField label="Login URL" hint="for SP-initiated sign-in" value={urls.login} />
          <CopyField label="SP metadata" hint="if your provider can import it" value={urls.metadata} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Send the user&apos;s email as the NameID (or an <code>email</code> attribute), sign the assertion, and, to use roles from groups, include the group
          attribute named below.
        </p>
      </Card>

      <Card step={2} title="Identity provider details" done={configured}>
        {configured && (
          <dl className="mb-3 grid gap-1 text-sm">
            <div>
              <dt className="inline text-muted-foreground">Entity ID: </dt>
              <dd className="inline break-all font-mono text-xs">{conn.idpEntityId || "—"}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Sign-in URL: </dt>
              <dd className="inline break-all font-mono text-xs">{conn.idpSsoUrl}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Certificate expires: </dt>
              <dd className={cn("inline", certSoon && "font-medium text-destructive")}>
                {conn.certExpiry ? new Date(conn.certExpiry).toLocaleDateString(undefined, { dateStyle: "medium" }) : "unknown"}
                {certSoon && " — upload the new certificate before then"}
              </dd>
            </div>
          </dl>
        )}
        {!manual ? (
          <>
            <label className="mb-1 block text-sm font-medium" htmlFor="idp-xml">
              {configured ? "Replace with new metadata" : "Paste the identity provider's SAML metadata (XML)"}
            </label>
            <Textarea id="idp-xml" value={xml} onChange={(e) => setXml(e.target.value)} rows={5} className="font-mono text-xs" placeholder='<?xml version="1.0"?><md:EntityDescriptor …' />
            <button type="button" className="mt-1 text-xs text-primary underline" onClick={() => setManual(true)}>
              Enter the values by hand instead
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Input value={idp.entityId} onChange={(e) => setIdp({ ...idp, entityId: e.target.value })} placeholder="IdP Entity ID (Issuer)" aria-label="IdP Entity ID" />
            <Input value={idp.ssoUrl} onChange={(e) => setIdp({ ...idp, ssoUrl: e.target.value })} placeholder="IdP sign-in URL (https://…)" aria-label="IdP sign-in URL" />
            <Textarea value={idp.cert} onChange={(e) => setIdp({ ...idp, cert: e.target.value })} rows={4} className="font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----" aria-label="IdP signing certificate" />
            <button type="button" className="self-start text-xs text-primary underline" onClick={() => setManual(false)}>
              Paste metadata instead
            </button>
          </div>
        )}
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            disabled={pending || (!manual && !xml.trim())}
            onClick={() =>
              start(async () => {
                const r = await saveIdentityProvider(manual ? idp : { metadataXml: xml });
                setIdpMsg("error" in r ? { error: r.error } : { ok: "Saved." });
                if (!("error" in r)) setXml("");
              })
            }
          >
            Save identity provider
          </Button>
          <Status msg={idpMsg} />
        </div>
      </Card>

      <Card step={3} title="Sign-in" done={conn.enabled}>
        <div className="flex flex-col gap-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={opts.enabled} onChange={(e) => setOpts({ ...opts, enabled: e.target.checked })} />
            <span>
              <span className="font-medium">Turn on single sign-on</span>
              <span className="block text-muted-foreground">Members can sign in with “Sign in with SSO” and from your identity provider&apos;s app portal.</span>
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Email domains</span>
            <Input value={opts.domains} onChange={(e) => setOpts({ ...opts, domains: e.target.value })} placeholder="example.com, example.org" />
            <span className="text-xs text-muted-foreground">“Sign in with SSO” sends people with these email domains to this identity provider.</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Group attribute name</span>
            <Input value={opts.groupAttribute} onChange={(e) => setOpts({ ...opts, groupAttribute: e.target.value })} className="max-w-xs" />
            <span className="text-xs text-muted-foreground">
              The SAML attribute that lists the user&apos;s groups (JumpCloud: “Groups Attribute Name”). Must match exactly.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={opts.jitProvisioning} onChange={(e) => setOpts({ ...opts, jitProvisioning: e.target.checked })} />
            <span>
              <span className="font-medium">Create members on first sign-in</span>
              <span className="block text-muted-foreground">Anyone your identity provider lets into the app gets a Tavoro account. Off: only people already added (or provisioned by SCIM) can sign in.</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5" checked={opts.requireSso} onChange={(e) => setOpts({ ...opts, requireSso: e.target.checked })} />
            <span>
              <span className="font-medium">Require single sign-on</span>
              <span className="block text-muted-foreground">Members can&apos;t use a password. Admins still can, so you can get in if the identity provider is down.</span>
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await saveSsoOptions({ ...opts, domains: opts.domains.split(/[,\s]+/).filter(Boolean) });
                  setOptMsg("error" in r ? { error: r.error } : { ok: "Saved." });
                })
              }
            >
              Save sign-in settings
            </Button>
            {conn.enabled && (
              <a href={urls.login} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
                Test sign-in in a new tab
              </a>
            )}
            <Status msg={optMsg} />
          </div>
        </div>
      </Card>

      <Card step={4} title="Provisioning (SCIM 2.0)" done={conn.scimEnabled}>
        <p className="mb-3 text-sm text-muted-foreground">
          Lets your identity provider create, update and deactivate members, and send their groups. Deactivated members are suspended: they can&apos;t sign in, and
          their work stays.
        </p>
        <div className="flex flex-col gap-3">
          <CopyField label="SCIM base URL" hint="JumpCloud: Base URL" value={urls.scim} />
          {token ? (
            <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
              <CopyField label="SCIM token" hint="JumpCloud: Token Key — shown once" value={token} />
              <p className="mt-2 text-xs text-muted-foreground">Copy it now and paste it into your identity provider. Tavoro keeps only a hash.</p>
            </div>
          ) : (
            <p className="text-sm">
              <KeyRound className="mr-1 inline size-4 text-muted-foreground" />
              {conn.scimTokenHint ? (
                <>
                  Token ending <span className="font-mono">{conn.scimTokenHint}</span> is {conn.scimEnabled ? "active" : "off"}.
                </>
              ) : (
                "No token yet."
              )}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (conn.scimTokenHint && !confirm("Make a new token? The current one stops working immediately.")) return;
                  const r = await createScimToken();
                  if ("error" in r) setScimMsg({ error: r.error });
                  else {
                    setToken(r.token);
                    setScimMsg(null);
                  }
                })
              }
            >
              {conn.scimTokenHint ? "Replace token" : "Create token"}
            </Button>
            {conn.scimEnabled && (
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    if (!confirm("Turn provisioning off? The token is deleted and your identity provider's requests will fail.")) return;
                    const r = await setScimEnabled(false);
                    setScimMsg("error" in r ? { error: r.error } : { ok: "Provisioning is off." });
                    setToken(null);
                  })
                }
              >
                Turn off
              </Button>
            )}
            <Status msg={scimMsg} />
          </div>
        </div>
      </Card>

      <Card step={5} title="Roles from groups" done={conn.manageRoles}>
        <p className="mb-3 text-sm text-muted-foreground">
          Give members a Tavoro role from their identity-provider groups, from SCIM and from each sign-in. A member gets the highest role any of their groups
          maps to, or the default. Tavoro never demotes the last admin.
        </p>
        <label className="mb-3 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={manageRoles} onChange={(e) => setManageRoles(e.target.checked)} />
          Manage roles from groups
        </label>
        <div className={cn("flex flex-col gap-2", !manageRoles && "opacity-60")}>
          <datalist id="idp-groups">
            {conn.groups.map((g) => (
              <option key={g.name} value={g.name} />
            ))}
          </datalist>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                list="idp-groups"
                value={r.groupName}
                onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, groupName: e.target.value } : x)))}
                placeholder="Group name, e.g. Tavoro Admins"
                aria-label="Group name"
                disabled={!manageRoles}
              />
              <span className="shrink-0 text-sm text-muted-foreground">→</span>
              <Select
                className="w-auto"
                value={r.role}
                onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, role: e.target.value as RoleName } : x)))}
                aria-label="Role"
                disabled={!manageRoles}
              >
                {(Object.keys(ROLE_LABEL) as RoleName[]).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
              <Button size="icon-sm" variant="ghost" title="Remove" onClick={() => setRows(rows.filter((_, k) => k !== i))} disabled={!manageRoles}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" className="self-start" onClick={() => setRows([...rows, { groupName: "", role: "MEMBER" }])} disabled={!manageRoles}>
            <Plus className="size-4" /> Add mapping
          </Button>
          <label className="mt-1 flex items-center gap-2 text-sm">
            Everyone else:
            <Select className="w-auto" value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as RoleName)} disabled={!manageRoles} aria-label="Default role">
              <option value="MEMBER">Member</option>
              <option value="MANAGER">Manager</option>
            </Select>
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveRoleMappings({ manageRoles, defaultRole, mappings: rows.filter((x) => x.groupName.trim()) });
                setRoleMsg("error" in r ? { error: r.error } : { ok: "Saved, and roles updated." });
              })
            }
          >
            Save roles
          </Button>
          <Status msg={roleMsg} />
        </div>
        {conn.groups.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" /> Groups Tavoro has received
            </p>
            <ul className="flex flex-wrap gap-1.5 text-xs">
              {conn.groups.map((g) => (
                <li key={g.name} className="rounded-md border border-border px-2 py-0.5">
                  {g.name} <span className="text-muted-foreground">· {g.members}</span>
                  {!g.fromScim && <span className="text-muted-foreground"> · from sign-in</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <section>
        <SectionHeader>Recent provisioning requests</SectionHeader>
        {conn.scimLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Requests from your identity provider show up here, newest first.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {conn.scimLogs.map((l) => (
              <li key={l.id}>
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2">
                    <span className={cn("w-10 font-mono text-xs", l.status >= 400 ? "text-destructive" : "text-success-ink")}>{l.status}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {l.method} {l.path.length > 60 ? `${l.path.slice(0, 57)}…` : l.path}
                    </span>
                    <span className="min-w-0 flex-1">{l.summary}</span>
                    <span className="text-xs text-muted-foreground">{when(l.createdAt)}</span>
                  </summary>
                  {l.request && <pre className="max-h-64 overflow-auto border-t border-border bg-muted px-3 py-2 font-mono text-[11px]">{l.request}</pre>}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
