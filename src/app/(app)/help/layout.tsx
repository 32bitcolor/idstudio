import { PageContainer } from "@/components/shared/page";
import { HelpNav } from "@/components/help/help-nav";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer size="wide">
      <div className="grid gap-8 md:grid-cols-[13rem_1fr] lg:gap-12">
        <aside className="md:sticky md:top-6 md:h-fit">
          <HelpNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </PageContainer>
  );
}
