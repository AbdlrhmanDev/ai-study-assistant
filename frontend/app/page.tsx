import Link from "next/link";
import { ArrowRight, Brain, Code2, Flame, Menu, Play, Sparkles } from "lucide-react";

const features = [
  ["01", "Organize your learning", "Create focused study topics and keep every note exactly where it belongs."],
  ["02", "Understand anything", "Ask your AI tutor for a clear, beginner-friendly explanation whenever you get stuck."],
  ["03", "Practice with purpose", "Turn your notes into concise summaries and five-question quizzes in one click."],
];

export default function Home() {
  return (
    <main className="landing">
      <nav className="topbar">
        <Link className="brand" href="/"><span className="brand-mark">s</span>studia</Link>
        <div className="nav-links">
          <a href="#features">Features</a><a href="#how">How it works</a>
        </div>
        <details className="landing-mobile-menu">
          <summary aria-label="Open navigation"><Menu size={21} aria-hidden="true" /></summary>
          <div>
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <Link href="/login">Log in</Link>
          </div>
        </details>
        <div className="nav-actions">
          <Link className="text-button" href="/login">Log in</Link>
          <Link className="button button-dark button-small" href="/register">Start learning <span><ArrowRight size={14} /></span></Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span><Sparkles size={13} /></span> AI-powered study companion</div>
          <h1>Learn smarter.<br /><em>Remember more.</em></h1>
          <p>Bring your topics and notes together, then let a thoughtful AI tutor help you understand, summarize, and practice.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/register">Start learning for free <span><ArrowRight size={15} /></span></Link>
            <a className="watch-link" href="#how"><span className="play"><Play size={11} fill="currentColor" /></span> See how it works</a>
          </div>
          <div className="hero-proof">
            <div className="avatars"><span>AM</span><span>JS</span><span>RK</span><span>+</span></div>
            <p><strong>4.9/5</strong><br />Loved by curious learners</p>
          </div>
        </div>

        <div className="hero-visual" aria-label="Studia dashboard preview">
          <div className="orb orb-one" /><div className="orb orb-two" />
          <div className="preview-window">
            <div className="preview-rail">
              <span className="mini-logo">s</span><i /><i /><i /><i />
              <i className="rail-bottom" />
            </div>
            <div className="preview-content">
              <div className="preview-head"><div><small>GOOD MORNING</small><h3>Ready to learn?</h3></div><span className="preview-avatar">MA</span></div>
              <div className="progress-card">
                <div><small>WEEKLY PROGRESS</small><strong>12.5 <b>hours</b></strong></div>
                <div className="bars"><i /><i /><i /><i /><i /><i /><i /></div>
              </div>
              <div className="preview-section-title"><b>Your topics</b><span>View all</span></div>
              <div className="topic-mini"><span className="topic-icon purple"><Brain size={18} strokeWidth={1.8} /></span><div><b>Machine Learning</b><small>8 notes · 65% complete</small></div><em><ArrowRight size={13} /></em></div>
              <div className="topic-mini"><span className="topic-icon peach"><Code2 size={18} strokeWidth={1.8} /></span><div><b>Python Fundamentals</b><small>12 notes · 42% complete</small></div><em><ArrowRight size={13} /></em></div>
            </div>
          </div>
          <div className="floating-card float-ai"><span><Sparkles size={16} /></span><div><b>AI Tutor</b><small>Ask me anything</small></div></div>
          <div className="floating-card float-streak"><span><Flame size={16} /></span><div><b>7 day streak</b><small>Keep it going!</small></div></div>
        </div>
      </section>

      <section className="features" id="features">
        <div className="section-kicker">EVERYTHING YOU NEED</div>
        <h2>A calmer way to master<br />what matters.</h2>
        <div className="feature-grid">
          {features.map(([number, title, body]) => (
            <article key={number}><span>{number}</span><h3>{title}</h3><p>{body}</p></article>
          ))}
        </div>
      </section>

      <section className="how" id="how">
        <div><div className="section-kicker">SIMPLE BY DESIGN</div><h2>From scattered notes<br />to real understanding.</h2></div>
        <p>Create a topic, add what you know, and ask Studia to help you connect the dots. Your next breakthrough is a question away.</p>
      </section>

      <footer><Link className="brand" href="/"><span className="brand-mark">s</span>studia</Link><p>Study with clarity. Grow with confidence.</p><span>© 2026 Studia</span></footer>
    </main>
  );
}
