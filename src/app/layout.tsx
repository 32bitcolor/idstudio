import type { Metadata } from "next";
import { Bricolage_Grotesque, Mulish, Geist_Mono } from "next/font/google";
import "./globals.css";

const mulish = Mulish({
  variable: "--font-sans-body",
  subsets: ["latin"],
});

// The Tavoro wordmark only (components/shared/brand.tsx).
const brand = Bricolage_Grotesque({
  variable: "--font-brand-face",
  subsets: ["latin"],
  weight: ["700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tavoro",
  description: "Instructional Designer Workspace — kanban, projects, storyboards, LMS sync.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${mulish.variable} ${brand.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* Apply the saved theme before paint to avoid a flash of the default theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('tavoro-theme')||localStorage.getItem('idstudio-theme');if(t&&t!=='system'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
