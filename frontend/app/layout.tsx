import type { Metadata } from "next";
import "./globals.css";
import { THEME_SCRIPT } from "./lib/theme-script";
import { ThemeProvider } from "./components/ThemeProvider";

export const metadata: Metadata = {
  title: "Studia — AI Study Assistant",
  description: "Organize your learning, understand difficult topics, and practice with an AI-powered study companion.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
