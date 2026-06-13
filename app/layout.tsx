import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CPE Use of English — Trainer",
  description: "Infinite mock-test trainer for the C2 Proficiency Use of English paper.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink antialiased">
        <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}
