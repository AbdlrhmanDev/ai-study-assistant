import type { Metadata } from "next";
import "../src/index.css";
import AppProviders from "../src/components/AppProviders";

export const metadata: Metadata = {
  title: "Studia | AI Study Assistant",
  description: "An AI-powered workspace for learning, practice, and review.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AppProviders>{children}</AppProviders></body>
    </html>
  );
}
