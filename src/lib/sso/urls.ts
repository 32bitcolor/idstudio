import "server-only";
import { appUrl } from "@/lib/app-url";

// The addresses an identity provider is configured with (docs/SSO.md). They're
// built from APP_URL, so they stay the same whichever hostname an admin is on.

const base = () => (appUrl("/") ?? "").replace(/\/$/, "");

export const ssoUrls = (connectionId: string) => ({
  /** SP Entity ID (JumpCloud: "SP Entity ID"); also where the SP metadata lives. */
  entityId: `${base()}/api/sso/${connectionId}/metadata`,
  /** Assertion Consumer Service (JumpCloud: "ACS URL"). */
  acs: `${base()}/api/sso/${connectionId}/acs`,
  /** Starts a sign-in from Tavoro (JumpCloud: "Login URL"). */
  login: `${base()}/api/sso/${connectionId}/login`,
  metadata: `${base()}/api/sso/${connectionId}/metadata`,
});

/** SCIM base URL (JumpCloud: "Base URL"; no trailing slash). */
export const scimBaseUrl = () => `${base()}/api/scim/v2`;
