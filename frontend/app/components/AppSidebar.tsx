"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Target,
  X,
} from "lucide-react";
import { api } from "../lib/api";
import { useTheme } from "./ThemeProvider";

const mainItems = [
  { href: "/dashboard", Icon: LayoutDashboard, label: "Overview" },
  { href: "/topics", Icon: BookOpen, label: "My topics" },
  { href: "/workspace", Icon: NotebookPen, label: "Workspace" },
  { href: "/coach", Icon: Target, label: "Study coach" },
  { href: "/flashcards", Icon: Layers, label: "Flashcards" },
  { href: "/quizzes", Icon: ListChecks, label: "Quizzes" },
  { href: "/exams", Icon: ClipboardCheck, label: "Exams" },
  { href: "/ai-tutor", Icon: Sparkles, label: "AI tutor" },
  { href: "/study-history", Icon: History, label: "Study history" },
  { href: "/analytics", Icon: BarChart3, label: "Analytics" },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(
        window.localStorage.getItem("studia-sidebar") === "collapsed",
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

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
    (href === "/workspace" && pathname === "/workspace-page") ||
    (href === "/flashcards" && pathname.startsWith("/flashcards/")) ||
    (href === "/quizzes" && pathname.startsWith("/quizzes/")) ||
    (href === "/exams" && pathname.startsWith("/exams/"));

  return (
    <>
      <button
        className="sidebar-mobile-trigger"
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu size={19} strokeWidth={1.8} />
      </button>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-heading">
        <Link className="sidebar-brand brand" href="/dashboard"><span className="brand-mark">s</span><strong>studia</strong></Link>
        <button
          className="sidebar-toggle"
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Minimize sidebar"}
          title={collapsed ? "Expand sidebar" : "Minimize sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
        <button
          className="sidebar-mobile-close"
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>
      <nav>
        {mainItems.map((item) => (
          <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href} title={collapsed ? item.label : undefined}>
            <span><item.Icon size={19} strokeWidth={1.8} /></span><em>{item.label}</em>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <button
          className="sidebar-logout"
          type="button"
          onClick={toggleTheme}
          title={collapsed ? (theme === "dark" ? "Switch to light mode" : "Switch to dark mode") : undefined}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          <span>{theme === "dark" ? <Sun size={19} strokeWidth={1.8} /> : <Moon size={19} strokeWidth={1.8} />}</span>
          <em>{theme === "dark" ? "Light mode" : "Dark mode"}</em>
        </button>
        <Link className={pathname === "/settings" ? "active" : ""} href="/settings"><span><SettingsIcon size={19} strokeWidth={1.8} /></span><em>Settings</em></Link>
        <button className="sidebar-logout" type="button" onClick={logout} title={collapsed ? "Log out" : undefined}><span><LogOut size={19} strokeWidth={1.8} /></span><em>Log out</em></button>
      </div>
      </aside>
    </>
  );
}
