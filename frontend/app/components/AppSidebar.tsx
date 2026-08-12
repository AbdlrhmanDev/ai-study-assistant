"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  History,
  Home,
  Layers,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Brain,
  Settings as SettingsIcon,
  Sparkles,
  Sun,
  Target,
  X,
} from "lucide-react";
import { api, apiAssetUrl, User, warmApi } from "../lib/api";
import { useTheme } from "./theme-context";
import { CommandPalette } from "./CommandPalette";

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
  { href: "/mistakes", Icon: Brain, label: "Mistake notebook" },
  { href: "/analytics", Icon: BarChart3, label: "Analytics" },
];

const routeWarmups: Record<string, string[]> = {
  "/dashboard": ["/topics", "/flashcards/stats-summary", "/coach/plan/today", "/study-insights"],
  "/topics": ["/topics"],
  "/workspace": ["/workspace-pages", "/topics"],
  "/coach": ["/coach/plan/today", "/topics", "/coach/goals", "/goal-predictions"],
  "/flashcards": ["/topics", "/flashcards/stats-summary", "/flashcards/stats-by-topic"],
  "/quizzes": ["/topics", "/quizzes/counts-by-topic"],
  "/exams": ["/topics", "/exams/counts-by-topic"],
  "/ai-tutor": ["/topics"],
  "/analytics": ["/analytics/overview"],
  "/study-history": ["/study-history?page=1&limit=20", "/study-history/stats"],
  "/mistakes": ["/mistakes"],
};

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const loadProfile = () => api<{ user: User | null }>("/auth/me").then((result) => setUser(result.user)).catch(() => null);
    void loadProfile();
    window.addEventListener("studia:profile-updated", loadProfile);
    return () => window.removeEventListener("studia:profile-updated", loadProfile);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(
        window.localStorage.getItem("studia-sidebar") === "collapsed",
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

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

  function warmNavigation(href: string) {
    router.prefetch(href);
    for (const endpoint of routeWarmups[href] ?? []) {
      void warmApi(endpoint).catch(() => undefined);
    }
  }

  return (
    <>
      <CommandPalette />
      <header className="mobile-app-header">
        <Link className="mobile-app-brand" href="/dashboard" aria-label="Studia home"><span className="brand-mark">s</span><strong>studia</strong></Link>
        <Link className="mobile-profile-link" href="/settings" aria-label="Open profile settings">
          {apiAssetUrl(user?.profileImageUrl) ? <Image src={apiAssetUrl(user?.profileImageUrl) ?? ""} alt="" width={44} height={44} unoptimized /> : <span>{user?.name?.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "ST"}</span>}
        </Link>
      </header>
      <button
        className="sidebar-mobile-trigger"
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        aria-expanded={mobileOpen}
        aria-controls="studia-sidebar"
      >
        <Menu size={19} strokeWidth={1.8} />
      </button>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <aside id="studia-sidebar" aria-label="Primary navigation" className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
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
      <nav aria-label="Study tools">
        {mainItems.map((item) => (
          <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href} title={collapsed ? item.label : undefined} onPointerEnter={() => warmNavigation(item.href)} onFocus={() => warmNavigation(item.href)} onTouchStart={() => warmNavigation(item.href)} onClick={() => setMobileOpen(false)}>
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
      <nav className="dashboard-mobile-nav" aria-label="Quick navigation">
        <Link className={pathname === "/dashboard" ? "active" : ""} href="/dashboard" onPointerEnter={() => warmNavigation("/dashboard")} onFocus={() => warmNavigation("/dashboard")} onTouchStart={() => warmNavigation("/dashboard")} aria-current={pathname === "/dashboard" ? "page" : undefined}><Home size={20} /><span>Home</span></Link>
        <Link className={isActive("/topics") ? "active" : ""} href="/topics" onTouchStart={() => warmNavigation("/topics")} aria-current={isActive("/topics") ? "page" : undefined}><BookOpen size={20} /><span>Topics</span></Link>
        <Link className={pathname === "/ai-tutor" ? "active" : ""} href="/ai-tutor" onPointerEnter={() => warmNavigation("/ai-tutor")} onFocus={() => warmNavigation("/ai-tutor")} onTouchStart={() => warmNavigation("/ai-tutor")} aria-current={pathname === "/ai-tutor" ? "page" : undefined}><Sparkles size={20} /><span>AI tutor</span></Link>
        <Link className={pathname === "/settings" ? "active" : ""} href="/settings" aria-current={pathname === "/settings" ? "page" : undefined}><SettingsIcon size={20} /><span>Settings</span></Link>
        <button type="button" popoverTarget="app-more-menu" onClick={() => warmNavigation("/workspace")} aria-label="Open more navigation" aria-controls="app-more-menu"><Menu size={20} /><span>More</span></button>
      </nav>
      <section id="app-more-menu" className="dashboard-more-sheet" popover="auto" role="dialog" aria-labelledby="app-more-title">
        <header><div><span>STUDY TOOLS</span><h2 id="app-more-title">More</h2></div><button type="button" popoverTarget="app-more-menu" popoverTargetAction="hide" aria-label="Close more navigation"><X size={20} /></button></header>
        <nav aria-label="More study tools">
          {mainItems.filter((item) => !["/dashboard", "/topics", "/ai-tutor"].includes(item.href)).map((item) => (
            <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href} onPointerEnter={() => warmNavigation(item.href)} onFocus={() => warmNavigation(item.href)} onTouchStart={() => warmNavigation(item.href)}><item.Icon size={20}/><span>{item.label}</span></Link>
          ))}
        </nav>
      </section>
    </>
  );
}
