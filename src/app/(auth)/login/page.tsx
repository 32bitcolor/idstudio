import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Sign in · IDStudio" };

export default function LoginPage() {
  return (
    <>
      <h2 className="mb-4 text-lg font-medium">Sign in</h2>
      <LoginForm />
    </>
  );
}
