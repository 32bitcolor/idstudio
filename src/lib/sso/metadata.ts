import "server-only";
import { DOMParser } from "@xmldom/xmldom";
import * as xpath from "xpath";

// Reading an identity provider's SAML metadata (the XML JumpCloud offers as "Export
// Metadata"), so an admin pastes one file instead of copying three fields by hand.

const select = xpath.useNamespaces({
  md: "urn:oasis:names:tc:SAML:2.0:metadata",
  ds: "http://www.w3.org/2000/09/xmldsig#",
});

export type IdpMetadata = { entityId: string; ssoUrl: string; certs: string[] };

const REDIRECT = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect";
const POST = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";

export function toPem(b64: string): string {
  const body = b64.replace(/-----(BEGIN|END) CERTIFICATE-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN CERTIFICATE-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END CERTIFICATE-----`;
}

/** Every certificate in a pasted PEM blob (or one bare base64 body). */
export function splitPem(text: string): string[] {
  const found = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
  if (found) return found.map(toPem);
  const bare = text.replace(/\s+/g, "");
  return /^[A-Za-z0-9+/=]{200,}$/.test(bare) ? [toPem(bare)] : [];
}

export function parseIdpMetadata(xml: string): IdpMetadata | { error: string } {
  if (xml.length > 200_000) return { error: "That metadata is too large." };
  // No DTDs: metadata never needs one, and refusing them rules out entity tricks.
  if (/<!DOCTYPE/i.test(xml)) return { error: "Metadata with a DOCTYPE isn't accepted." };
  let doc;
  try {
    doc = new DOMParser({ onError: () => {} }).parseFromString(xml, "text/xml");
  } catch {
    return { error: "That isn't valid XML." };
  }
  const entity = select("//md:EntityDescriptor", doc as unknown as Node, true) as Element | undefined;
  const idp = select("//md:IDPSSODescriptor", doc as unknown as Node, true) as Element | undefined;
  if (!entity || !idp) return { error: "No identity provider (IDPSSODescriptor) in that metadata." };
  const services = select("md:SingleSignOnService", idp as unknown as Node) as Element[];
  const sso = services.find((s) => s.getAttribute("Binding") === REDIRECT) ?? services.find((s) => s.getAttribute("Binding") === POST);
  if (!sso?.getAttribute("Location")) return { error: "No sign-in URL (SingleSignOnService) in that metadata." };
  const location = sso.getAttribute("Location")!.trim();
  // An app whose IdP URL isn't set properly exports a bare name here (JumpCloud does);
  // saving it would send every sign-in nowhere.
  if (!/^https:\/\/[^\s/]+\.[^\s/]+(\/|$)/.test(location)) {
    return { error: `The sign-in URL in that metadata ("${location.slice(0, 80)}") isn't a full https:// address. Fix the app's IdP URL in your identity provider, then export the metadata again.` };
  }
  const keys = select("md:KeyDescriptor[not(@use) or @use='signing']//ds:X509Certificate", idp as unknown as Node) as Element[];
  const certs = [...new Set(keys.map((k) => (k.textContent ?? "").replace(/\s+/g, "")).filter(Boolean))].map(toPem);
  if (!certs.length) return { error: "No signing certificate in that metadata." };
  return { entityId: entity.getAttribute("entityID") ?? "", ssoUrl: location, certs };
}
