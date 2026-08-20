'use client'
import { useNavigate } from '../lib/navigation'

const CHANNELS = [
  { icon: '💬', name: 'General', desc: 'Introductions, off-topic, anything goes', members: 2841 },
  { icon: '🧠', name: 'Learning science', desc: 'Research, papers, study technique debates', members: 984 },
  { icon: '📚', name: 'Share your decks', desc: 'Swap flashcard decks across subjects', members: 1562 },
  { icon: '🎯', name: 'Exam prep', desc: 'USMLE, LSAT, bar exam, board-specific tips', members: 3104 },
  { icon: '🐛', name: 'Bug reports', desc: 'Found something broken? Tell us here first', members: 218 },
  { icon: '✨', name: 'Feature requests', desc: 'Vote on ideas and request new features', members: 671 },
]

const POSTS = [
  {
    channel: 'Exam prep', channelColor: '#e8845a', channelBg: '#faeee7',
    title: 'How I passed USMLE Step 1 using only Studia for 8 weeks',
    preview: "I want to share my experience for anyone preparing for boards. I uploaded Pathoma, First Aid chapters, and my lecture notes, then let the coach build my daily plan...",
    author: 'Marcus C.', av: '#7c8fa5', i: 'M', time: '3 hours ago', likes: 142, replies: 38,
  },
  {
    channel: 'Share your decks', channelColor: '#6d5ef6', channelBg: '#ede9ff',
    title: 'Biochemistry deck — 340 cards covering enzyme kinetics, amino acids, and metabolic pathways',
    preview: "Spent 3 weeks building this with the AI tutor and editing the cards manually. Covers all HY topics from First Aid. DM me the workspace link...",
    author: 'Riya P.', av: '#9b7ea5', i: 'R', time: '6 hours ago', likes: 87, replies: 24,
  },
  {
    channel: 'Learning science', channelColor: '#5a8f7c', channelBg: '#e4f4ee',
    title: 'Does interleaving actually work better than blocked practice for medical knowledge?',
    preview: "There\'s a good meta-analysis from 2023 (Taylor & Rohrer) that covers this specifically for clinical knowledge. TLDR: yes for recognition tasks, mixed evidence for procedural...",
    author: 'Dr. Priya M.', av: '#6d5ea5', i: 'P', time: 'Yesterday', likes: 63, replies: 19,
  },
  {
    channel: 'Feature requests', channelColor: '#3a8fa5', channelBg: '#e4f4f8',
    title: 'Collaborative topics — share a topic library with your study group',
    preview: "My cohort and I are all using Studia separately. It would be great if we could have a shared topic where we all contribute notes and flashcards...",
    author: 'James T.', av: '#a5763a', i: 'J', time: '2 days ago', likes: 201, replies: 47,
  },
]

export default function Community() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Hero */}
      <section style={{ padding: '64px 24px 48px', maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 16 }}>
          Study together
        </h1>
        <p style={{ fontSize: 16, color: 'var(--color-text-2)', lineHeight: 1.65, marginBottom: 28 }}>
          Join 8,400+ students sharing decks, strategies, and support.
        </p>
        <button onClick={() => navigate('/app')} style={{ fontSize: 14, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 11, padding: '12px 24px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(109,94,246,0.35)' }}>
          Join the community
        </button>
      </section>

      <section style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 96px', display: 'grid', gridTemplateColumns: '280px 1fr', gap: 28, alignItems: 'start' }} className="comm-grid">
        {/* Channels */}
        <div>
          <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>Channels</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CHANNELS.map((ch, i) => (
              <button key={i} onClick={() => navigate('/app')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 12, background: i === 3 ? '#ede9ff' : 'var(--color-surface)', border: i === 3 ? '1px solid #c5bcfa' : '1px solid var(--color-border)', cursor: 'pointer', textAlign: 'left', transition: 'background 0.12s' }}
                onMouseEnter={e => { if (i !== 3) e.currentTarget.style.background = 'var(--color-bg)' }}
                onMouseLeave={e => { if (i !== 3) e.currentTarget.style.background = 'var(--color-surface)' }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{ch.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: i === 3 ? '#6d5ef6' : 'var(--color-text)' }}>{ch.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.members.toLocaleString()} members</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Recent posts</div>
            <button onClick={() => navigate('/app')} style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: '#6d5ef6', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}>+ New post</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {POSTS.map((post, i) => (
              <div key={i}
                onClick={() => navigate('/app')}
                style={{ background: 'var(--color-surface)', borderRadius: 16, border: '1px solid var(--color-border)', padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(24,22,15,0.07)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: post.av, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{post.i}</div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>{post.author}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: post.channelColor, background: post.channelBg, borderRadius: 5, padding: '1px 7px' }}>{post.channel}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--color-text-subtle)' }}>{post.time}</span>
                    </div>
                  </div>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.35, marginBottom: 8 }}>{post.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: 14 }}>{post.preview}</p>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 12, color: '#9b9590', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
                    {post.likes}
                  </span>
                  <span style={{ fontSize: 12, color: '#9b9590', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                    {post.replies} replies
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 800px) { .comm-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
