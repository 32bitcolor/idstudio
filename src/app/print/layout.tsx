// Print views (the PDF export): no app chrome, the document on a neutral backdrop
// on screen, and nothing but the document on paper.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col bg-muted px-4 pb-10 print:bg-white print:p-0">{children}</main>;
}
