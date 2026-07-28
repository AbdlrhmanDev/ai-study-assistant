"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

const mainItems = [
  { href: "/dashboard", icon: "⌂", label: "Overview" },
  { href: "/topics", icon: "▤", label: "My topics" },
  { href: "/coach", icon: "◎", label: "Study coach" },
  { href: "/flashcards", icon: "◆", label: "Flashcards" },
  { href: "/quizzes", icon: "◈", label: "Quizzes" },
  { href: "/exams", icon: "◉", label: "Exams" },
  { href: "/ai-tutor", icon: "✦", label: "AI tutor" },
  { href: "/study-history", icon: "◷", label: "Study history" },
  { href: "/analytics", icon: "◫", label: "Analytics" },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(
        window.localStorage.getItem("studia-sidebar") === "collapsed",
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem("studia-sidebar", next ? "collapsed" : "expanded");
  }

  async function logout() {
    await api<null>("/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
  }

  const isActive = (href: string) =>
    pathname === href ||
    (href === "/topics" && pathname === "/topic") ||
    (href === "/flashcards" && pathname.startsWith("/flashcards/")) ||
    (href === "/quizzes" && pathname.startsWith("/quizzes/")) ||
    (href === "/exams" && pathname.startsWith("/exams/"));

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-heading">
        <Link className="sidebar-brand brand" href="/dashboard"><span className="brand-mark">s</span><strong>studia</strong></Link>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>
      <nav>
        {mainItems.map((item) => (
          <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href} title={collapsed ? item.label : undefined}>
            <span>{item.icon}</span><em>{item.label}</em>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <Link className={pathname === "/settings" ? "active" : ""} href="/settings"><span>⚙</span><em>Settings</em></Link>
        <button className="sidebar-logout" type="button" onClick={logout} title={collapsed ? "Log out" : undefined}><span>↪</span><em>Log out</em></button>
      </div>
    </aside>
  );
}
