import { getConnection } from "@/lib/sso/connection";
import { samlFor } from "@/lib/sso/saml";

// Tavoro's SAML service-provider metadata, for identity providers that import it.

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const conn = await getConnection((await params).id);
  if (!conn) return new Response("Not found", { status: 404 });
  const xml = samlFor(conn).generateServiceProviderMetadata(null);
  return new Response(xml, { headers: { "content-type": "application/samlmetadata+xml; charset=utf-8" } });
}
