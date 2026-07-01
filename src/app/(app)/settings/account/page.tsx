import { requireUser } from "@/lib/dal";
import { AccountForm } from "@/components/settings/account-form";

export const metadata = { title: "Account · IDStudio" };

export default async function AccountSettingsPage() {
  const user = await requireUser();
  return <AccountForm email={user.email} name={user.name ?? null} />;
}
