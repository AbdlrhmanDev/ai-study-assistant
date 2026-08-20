import type { ReactNode } from "react";
import ProtectedApp from "@/components/ProtectedApp";
import AppShell from "@/components/AppShell";

export default function AppSectionLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedApp>
      <AppShell>{children}</AppShell>
    </ProtectedApp>
  );
}
