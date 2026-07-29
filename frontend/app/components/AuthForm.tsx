"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Sparkles, User as UserIcon } from "lucide-react";
import { api, messageFromError, User } from "../lib/api";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isLogin = mode === "login";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const data = new FormData(event.currentTarget);

    try {
      await api<{ user: User }>(
        isLogin ? "/auth/login" : "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            ...(!isLogin ? { name: data.get("name") } : {}),
            email: data.get("email"),
            password: data.get("password"),
          }),
        },
      );
      router.replace("/dashboard");
    } catch (requestError) {
      setError(messageFromError(requestError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-art">
        <Link className="brand brand-light" href="/"><span className="brand-mark">s</span>studia</Link>
        <div className="auth-quote">
          <span className="quote-mark">“</span>
          <blockquote>Learning never exhausts the mind. It only ignites it.</blockquote>
          <p>— Leonardo da Vinci</p>
        </div>
        <div className="auth-shape shape-a" /><div className="auth-shape shape-b" /><div className="auth-shape shape-c" />
        <p className="auth-art-footer">Your thoughtful AI study companion.</p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <Link className="mobile-brand brand" href="/"><span className="brand-mark">s</span>studia</Link>
          <div className="auth-heading">
            <div className="eyebrow"><span><Sparkles size={13} /></span> {isLogin ? "WELCOME BACK" : "YOUR LEARNING STARTS HERE"}</div>
            <h1>{isLogin ? "Continue your journey." : "Create your account."}</h1>
            <p>{isLogin ? "Sign in to pick up right where you left off." : "Join Studia and make every study session count."}</p>
          </div>
          <form onSubmit={submit}>
            {!isLogin && (
              <label>Full name
                <div className="input-icon-wrap">
                  <UserIcon size={16} strokeWidth={1.8} />
                  <input name="name" required minLength={2} placeholder="e.g. Maya Ahmed" autoComplete="name" />
                </div>
              </label>
            )}
            <label>Email address
              <div className="input-icon-wrap">
                <Mail size={16} strokeWidth={1.8} />
                <input name="email" required type="email" placeholder="you@example.com" autoComplete="email" />
              </div>
            </label>
            <label>Password
              <div className="input-icon-wrap password-wrap">
                <Lock size={16} strokeWidth={1.8} />
                <input name="password" required minLength={isLogin ? 1 : 8} type={showPassword ? "text" : "password"} placeholder={isLogin ? "Enter your password" : "At least 8 characters"} autoComplete={isLogin ? "current-password" : "new-password"} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}</button>
              </div>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button disabled={loading} className="button button-primary auth-submit" type="submit">
              {loading ? "Just a moment…" : isLogin ? "Sign in to Studia" : "Create my account"} <span><ArrowRight size={15} /></span>
            </button>
          </form>
          <div className="auth-switch">{isLogin ? "New to Studia?" : "Already have an account?"} <Link href={isLogin ? "/register" : "/login"}>{isLogin ? "Create an account" : "Sign in"}</Link></div>
        </div>
      </section>
    </main>
  );
}
