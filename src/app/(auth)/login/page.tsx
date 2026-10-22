import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in · Tavoro" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h2 className="mb-4 text-lg font-medium">Sign in</h2>
      <LoginForm next={typeof next === "string" ? next : undefined} />
    </>
  );
}
