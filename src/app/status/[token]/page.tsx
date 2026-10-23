import { notFound } from "next/navigation";
import { loadStatusPage } from "@/lib/intake-status";
import { checkThrottle, clientIp } from "@/lib/throttle";
import { StatusView } from "@/components/intake-status/status-view";

export const dynamic = "force-dynamic";

export default async function RequestStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A wrong or reset link is a plain 404, so a link can't be used to learn whether a
  // request exists.
  if (!(await checkThrottle(`status:${await clientIp()}`, 120, 60))) notFound();
  const page = await loadStatusPage(token);
  if (!page) notFound();
  return <StatusView page={page} token={token} />;
}
