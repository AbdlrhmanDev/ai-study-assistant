'use client'
import { useNavigate } from '../lib/navigation'

const POSTS = [
  {
    tag: 'Learning science', tagColor: '#6d5ef6', tagBg: '#ede9ff',
    title: 'Why your brain forgets — and how spaced repetition fixes it',
    excerpt: 'The forgetting curve has been replicated hundreds of times since Ebbinghaus first charted it in 1885. Here\'s what it means for how you study, and why reviewing the day before isn\'t enough.',
    author: 'Dr. Priya Mehta', authorRole: 'Learning scientist', date: 'Aug 9, 2026', readTime: '7 min', av: '#9b7ea5', i: 'P',
    featured: true,
  },
  {
    tag: 'Product', tagColor: '#5a8f7c', tagBg: '#e4f4ee',
    title: 'How Studia\'s AI tutor cites its sources',
    excerpt: 'Every answer the AI gives traces back to your uploaded material. We\'ll walk through the retrieval mechanism — chunking, embedding, and why this matters for medical students specifically.',
    author: 'James Okafor', authorRole: 'Co-founder', date: 'Aug 5, 2026', readTime: '5 min', av: '#7c8fa5', i: 'J',
    featured: false,
  },
  {
    tag: 'Study tips', tagColor: '#e8845a', tagBg: '#faeee7',
    title: 'Active recall vs passive re-reading: the evidence',
    excerpt: 'Re-reading your notes feels productive. The research says otherwise. We looked at 20 years of cognitive science to understand why testing yourself is the superior strategy — and by how much.',
    author: 'Aisha Nkemdirim', authorRole: 'Content lead', date: 'Jul 28, 2026', readTime: '9 min', av: '#a78b5f', i: 'A',
    featured: false,
  },
  {
    tag: 'Product', tagColor: '#5a8f7c', tagBg: '#e4f4ee',
    title: 'Building the Study Coach: how we decide what you study next',
    excerpt: 'Designing a daily study plan is an optimisation problem with a lot of moving parts: overdue cards, weak concepts, time available, and exam proximity. Here\'s how we approach it.',
    author: 'James Okafor', authorRole: 'Co-founder', date: 'Jul 18, 2026', readTime: '6 min', av: '#7c8fa5', i: 'J',
    featured: false,
  },
  {
    tag: 'Learning science', tagColor: '#6d5ef6', tagBg: '#ede9ff',
    title: 'The interleaving effect: why mixing topics improves retention',
    excerpt: 'Blocked practice (finishing one topic before moving to the next) feels easier. Interleaved practice (mixing topics) is harder — and dramatically more effective. Here\'s the data.',
    author: 'Dr. Priya Mehta', authorRole: 'Learning scientist', date: 'Jul 8, 2026', readTime: '8 min', av: '#9b7ea5', i: 'P',
    featured: false,
  },
  {
    tag: 'Student stories', tagColor: '#c04a8b', tagBg: '#faeaf3',
    title: '"I went from failing midterms to 84% on finals" — Layla\'s story',
    excerpt: 'Layla Al-Hassan was two weeks from her Biochemistry midterm with no clear plan. She started using Studia. Here\'s what happened over the next four months.',
    author: 'Studia team', authorRole: '', date: 'Jun 28, 2026', readTime: '4 min', av: '#a78b5f', i: 'L',
    featured: false,
  },
]

export default function Blog() {
  const navigate = useNavigate()
  const featured = POSTS.find(p => p.featured)
  const rest = POSTS.filter(p => !p.featured)

  return (
    <div>
      {/* Header */}
      <section style={{ padding: '64px 24px 48px', maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 12 }}>
          The Studia blog
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-2)' }}>Learning science, product updates, and student stories.</p>
      </section>

      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 96px' }}>
        {/* Featured post */}
        {featured && (
          <div
            onClick={() => navigate('/blog')}
            style={{ background: '#18160f', borderRadius: 22, padding: '40px', marginBottom: 32, cursor: 'pointer', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center', transition: 'box-shadow 0.15s' }}
            className="blog-featured"
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 16px 48px rgba(24,22,15,0.2)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
          >
            <div>
              <div style={{ display: 'inline-flex', marginBottom: 18, fontSize: 11, fontWeight: 700, color: featured.tagColor, background: `${featured.tagColor}25`, borderRadius: 6, padding: '3px 10px' }}>{featured.tag}</div>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: '#f7f5f1', lineHeight: 1.25, marginBottom: 14 }}>{featured.title}</h2>
              <p style={{ fontSize: 14, color: 'rgba(247,245,241,0.5)', lineHeight: 1.65, marginBottom: 24 }}>{featured.excerpt}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: featured.av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{featured.i}</div>
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(247,245,241,0.7)' }}>{featured.author}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(247,245,241,0.3)' }}>{featured.date} · {featured.readTime} read</div>
                </div>
              </div>
            </div>
            <div style={{ background: 'rgba(109,94,246,0.15)', borderRadius: 16, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64 }}>
              🧠
            </div>
          </div>
        )}

        {/* Post grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {rest.map((post, i) => (
            <div key={i}
              onClick={() => navigate('/blog')}
              style={{ background: 'var(--color-surface)', borderRadius: 18, border: '1px solid var(--color-border)', padding: '24px', cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 28px rgba(24,22,15,0.08)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'inline-flex', marginBottom: 14, fontSize: 10.5, fontWeight: 700, color: post.tagColor, background: post.tagBg, borderRadius: 6, padding: '3px 9px' }}>{post.tag}</div>
              <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3, marginBottom: 10 }}>{post.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 20 }}>{post.excerpt.slice(0, 120)}…</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: post.av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{post.i}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-2)' }}>{post.author}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-subtle)' }}>{post.date} · {post.readTime}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <style>{`
        @media (max-width: 700px) { .blog-featured { grid-template-columns: 1fr !important; } .blog-featured > div:last-child { display: none; } }
      `}</style>
    </div>
  )
}
