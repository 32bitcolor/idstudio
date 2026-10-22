# Single sign-on, provisioning, and roles from groups

*Built 2026-10-22, tested end to end with JumpCloud.* Each workspace can connect one identity provider (IdP):
SAML 2.0 for sign-in, SCIM 2.0 for provisioning, and Tavoro roles derived from the IdP's groups. Admins
set it up in **Settings → Single sign-on**; the in-app guide is Help → *Single sign-on & provisioning*.
This doc records what was built and why.

## Decisions

1. **SAML, not OIDC.** JumpCloud attaches its custom SCIM connector only to SAML apps, so one SAML app
   gives sign-in and provisioning together. SAML is also what every enterprise IdP offers for custom apps.
   The code is IdP-neutral; JumpCloud only appears in hints and the default group attribute (`memberOf`).
2. **One connection per workspace** (`SsoConnection`), with its own SP entity ID and ACS URL
   (`/api/sso/<id>/{metadata,acs,login}`), so workspaces can use different IdPs.
3. **@node-saml/node-saml does the XML security.** Signature checks, audience, time bounds, InResponseTo.
   Tavoro accepts a signed **response or** a signed **assertion** (`wantAssertionsSigned` and
   `wantAuthnResponseSigned` both false, which in node-saml means "either, never neither"; it verifies the
   signature covers what it reads). JumpCloud signs the response by default; Okta and Entra sign the
   assertion. Requests aren't signed.
4. **Both sign-in directions.** IdP-initiated (the portal tile) is allowed: `InResponseTo` is checked when
   present (`ifPresent`) against request ids kept in Redis for 10 minutes, not in a cookie, because the
   IdP's POST back is cross-site and a Lax cookie wouldn't arrive. Each assertion is accepted once (a
   SHA-256 of it is held in Redis for an hour), so a captured response can't be replayed.
5. **"Sign in with SSO" is a real page load.** The button navigates to `/api/sso/start?email=…`, which
   picks the connection by email domain and redirects to the IdP. A server action can't do this: its
   redirect to an internal route is followed by `fetch`, which stops at the cross-site hop to the IdP (the
   button silently did nothing until this was changed). Only the email and return path go in the URL.
6. **Provisioning keeps people's work.** SCIM `active: false` and SCIM `DELETE` both *suspend* the
   membership (`Membership.suspendedAt`); DELETE also unlinks the `SsoIdentity`. A suspended member can't
   sign in, is left out of every member picker and access check, has their API tokens revoked, and gets no
   email (the worker skips anyone suspended in every workspace). Their cards, comments and reviews stay.
   An admin can **Restore access**; re-provisioning restores it too.
7. **A lenient SCIM server** (`/api/scim/v2`, `lib/sso/scim.ts`): Users and Groups with filters on
   `userName`, `emails[value eq]`, `externalId`, `displayName`, `id`; PATCH ops in any case, with or
   without a path, filtered member removal (`members[value eq "…"]`), `"True"`/`"False"` strings for
   booleans; ServiceProviderConfig, ResourceTypes and Schemas. Bearer token (`tavscim_…`, stored hashed),
   1,200 requests a minute. SCIM user ids are `SsoIdentity` ids; group ids are `IdpGroup` ids.
8. **Every request is logged** (`ScimLog`, last 200 per connection, passwords stripped) and shown in
   Settings, and every sign-in outcome is logged with its reason (`[sso]` lines in the app log). JumpCloud
   doesn't document its request shapes, so the log is how a new IdP gets understood.
9. **Roles from groups.** Mappings are group name → role, matched without regard to case; a member gets
   the highest mapped role (Admin > Manager > Member) or the default (Member or Manager, never Admin). Roles
   are recomputed when SCIM changes a group and at each sign-in. With SCIM on, it owns group membership; with
   it off, the assertion's group attribute does, and a missing attribute means "no groups" (IdPs omit it
   rather than send it empty), so a removed admin drops to the default. The last active admin is never
   demoted or suspended.
10. **Require SSO** blocks password sign-in for members of that workspace, not admins (the break-glass if
    the IdP is down). Sessions carry `sso: true` when they began with an assertion; `getActiveMembership`
    hides SSO-required workspaces from password sessions of non-admins, so a member of two workspaces
    can't reach the SSO one with a password. MCP tokens aren't re-checked (they were issued from a session
    that passed).
11. **Metadata import** parses the IdP's XML (`lib/sso/metadata.ts`; no DTDs, 200 KB cap) for entity ID,
    sign-in URL and signing certificates. Several certificates can be stored during a rollover. A sign-in
    URL that isn't a full `https://` address is refused (JumpCloud exports a bare name when the app's IdP
    URL is wrong). Settings warns 30 days before the certificate expires.

## Pieces

- `src/lib/sso/`: `saml.ts` (node-saml setup, Redis request cache, replay guard, profile reading),
  `provision.ts` (members, suspension, roles), `scim.ts`, `metadata.ts`, `connection.ts`, `urls.ts`.
- Routes: `src/app/api/sso/[id]/{metadata,login,acs}`, `src/app/api/sso/start`, `src/app/api/scim/v2/[...path]`.
- `src/app/actions/sso.ts` (admin only, browser only), `src/app/(app)/settings/sso`,
  `src/components/settings/sso-settings.tsx`, member badges in `members-manager.tsx`.
- Schema: `SsoConnection`, `SsoIdentity`, `IdpGroup`, `IdpGroupMember`, `SsoRoleMapping`, `ScimLog`,
  `Membership.suspendedAt` (migration `20261028090000_sso`).

## JumpCloud, as tested

- App: custom application, SAML 2.0 template (`saml2` in the API), with Identity Management. The SCIM
  ("Identity Management") settings have no public API; they're set in the Admin Portal.
- What JumpCloud sends on activation: `GET /Users?count=1`, `GET /Groups`, then a test user (POST, GET,
  filter by `userName`, PUT, DELETE) and a test group (POST, GET, PATCH displayName, DELETE). On sync it looks
  groups up by `displayName` and by `externalId` (its group id), creates them, looks users up by
  `userName` (twice), creates them, then PATCHes `members` with `add`.
- Gotchas: an app created through the API stores its IdP URL as given, so it must be the full
  `https://sso.jumpcloud.com/saml2/<name>` (a bare name breaks the portal tile and the exported metadata).
  "JumpCloud could not connect to your application" on the tile means the key pair is bad; *Actions →
  Regenerate Certificate* fixes it, and Tavoro then needs the new certificate. Updating the app through the
  API without the key fields regenerates the key pair too. The activation test user is left suspended in
  Tavoro afterwards.

## Testing

- A fake IdP (self-signed certificate, assertions signed with xml-crypto) drives an end-to-end suite: SCIM
  in the shapes JumpCloud, Okta and Entra use; IdP- and SP-initiated sign-in; refusal of replayed, tampered,
  unsigned, wrong-certificate, wrong-audience, expired and unsolicited responses; suspension; JIT on and off;
  roles from SCIM groups and from the assertion; Require SSO.
- JumpCloud (Planet Express org, app "Tavoro (test)"): activation, a full sync of six users and three
  groups with the right roles, and both sign-in directions.

## Ideas for later

- Single logout (SAML SLO) and ending Tavoro sessions when a member is suspended mid-session (today they
  lose access on their next request, because every request checks the membership).
- Mirroring IdP groups into Tavoro groups, so resource access can follow the IdP too.
- Provider guides for Okta, Entra ID and Google Workspace once each is tested.
