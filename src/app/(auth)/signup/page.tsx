import { SignupForm } from "@/components/signup-form";

export const metadata = { title: "Create account · IDStudio" };

export default function SignupPage() {
  return (
    <>
      <h2 className="mb-4 text-lg font-medium">Create your workspace</h2>
      <SignupForm />
    </>
  );
}
