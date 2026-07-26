import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Studia — AI Study Assistant",
  description: "Organize your learning, understand difficult topics, and practice with an AI-powered study companion.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
