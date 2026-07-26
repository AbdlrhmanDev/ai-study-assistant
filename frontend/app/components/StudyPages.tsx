"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AppSidebar from "./AppSidebar";

const topics = [
  { icon: "◎", color: "purple", title: "Machine Learning Basics", description: "Core concepts, models and practical examples.", notes: 8, updated: "Today", progress: 65, category: "Technology" },
  { icon: "⌘", color: "peach", title: "Python Fundamentals", description: "Syntax, data structures and clean code patterns.", notes: 12, updated: "Yesterday", progress: 42, category: "Programming" },
  { icon: "◫", color: "blue", title: "Backend APIs", description: "REST principles, endpoints and authentication.", notes: 5, updated: "Jul 18", progress: 28, category: "Development" },
  { icon: "◇", color: "green", title: "Neural Networks", description: "Layers, activation functions and model training.", notes: 4, updated: "Jul 12", progress: 18, category: "Technology" },
];

function PageShell({ children, title, subtitle, action }: { children: React.ReactNode; title: string; subtitle: string; action?: React.ReactNode }) {
  return <main className="dashboard-shell"><AppSidebar /><section className="dashboard-main">
    <header className="dash-top"><div className="page-breadcrumb"><span>Studia</span> / {title}</div><div className="dash-tools"><button aria-label="Notifications">♧<i /></button><span className="avatar">MA</span></div></header>
    <div className="subpage-content"><div className="subpage-title"><div><div className="section-kicker">YOUR LEARNING SPACE</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>{children}</div>
  </section></main>;
}

export function TopicsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All topics");
  const visible = topics.filter(t => (filter === "All topics" || t.category === filter) && t.title.toLowerCase().includes(query.toLowerCase()));
  return <PageShell title="My topics" subtitle="Everything you are learning, organized in one calm place." action={<button className="button button-primary">＋ New topic</button>}>
    <div className="topics-toolbar"><div className="search wide"><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all topics..." /></div>
      <div className="filter-pills">{["All topics","Technology","Programming","Development"].map(x=><button className={filter===x?"active":""} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div>
    </div>
    <div className="all-topics-grid">{visible.map(topic=><article className="full-topic-card" key={topic.title}>
      <div className="topic-card-top"><span className={`topic-icon ${topic.color}`}>{topic.icon}</span><button aria-label="Topic options">•••</button></div>
      <span className="topic-category">{topic.category}</span><h2>{topic.title}</h2><p>{topic.description}</p>
      <div className="topic-meta"><span>{topic.notes} notes</span><span>Updated {topic.updated}</span></div>
      <div className="topic-progress"><div><span>Progress</span><b>{topic.progress}%</b></div><i><em style={{width:`${topic.progress}%`}} /></i></div>
      <Link className="open-topic" href={`/topic?name=${encodeURIComponent(topic.title)}`}>Open topic <span>→</span></Link>
    </article>)}</div>
  </PageShell>;
}

const topicNotes = [
  { title: "What is machine learning?", body: "Machine learning allows computers to learn patterns from data instead of following only explicitly programmed rules.", date: "Updated today" },
  { title: "Supervised learning", body: "A model learns from labeled examples. Each training input includes the correct output, which acts like an answer key.", date: "Updated yesterday" },
  { title: "Training and testing data", body: "Training data teaches the model. Testing data checks whether it can make useful predictions on examples it has not seen.", date: "Updated Jul 22" },
];

export function TopicDetailPage() {
  const params = useSearchParams();
  const title = params.get("name") || "Machine Learning Basics";
  const [notes, setNotes] = useState(topicNotes);
  const [showNote, setShowNote] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [aiResult, setAiResult] = useState("Select an action and Studia will use your topic notes to help you learn.");

  function addNote(event: FormEvent) {
    event.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) return;
    setNotes([{ title: noteTitle, body: noteBody, date: "Added just now" }, ...notes]);
    setNoteTitle(""); setNoteBody(""); setShowNote(false);
  }

  return <PageShell title={title} subtitle="Build understanding one clear note at a time." action={<Link href="/topics" className="back-topics">← All topics</Link>}>
    <div className="topic-detail-hero">
      <div className="topic-detail-main"><span className="topic-icon purple">◎</span><div><span className="topic-category">Technology</span><h2>{title}</h2><p>Core concepts, models, and practical examples for building a strong machine learning foundation.</p></div></div>
      <div className="detail-progress"><strong>65%</strong><span>Topic progress</span><i><em /></i></div>
    </div>
    <div className="topic-detail-grid">
      <section className="notes-panel"><div className="section-head"><div><h2>Your notes</h2><p>{notes.length} notes in this topic</p></div><button className="add-note-button" onClick={()=>setShowNote(true)}>＋ Add note</button></div>
        <div className="notes-list">{notes.map((note,index)=><article key={note.title+index}><div><span>▤</span><div><h3>{note.title}</h3><p>{note.body}</p><small>{note.date}</small></div></div><button aria-label={`Options for ${note.title}`}>•••</button></article>)}</div>
      </section>
      <aside className="topic-ai-panel"><div className="ai-spark">✦</div><div className="section-kicker">AI STUDY TOOLS</div><h2>Learn with your notes</h2><p>Studia uses the context in this topic to give you focused, useful answers.</p>
        <div className="topic-ai-actions"><button onClick={()=>setAiResult("Machine learning teaches computers to recognize patterns from examples, much like you learn to identify a fruit after seeing several labeled pictures.")}>Explain simply <span>→</span></button><button onClick={()=>setAiResult("Your notes cover the definition of machine learning, supervised learning with labeled examples, and the distinct roles of training and testing data.")}>Summarize notes <span>→</span></button><button onClick={()=>setAiResult("Quiz: What is the main difference between training data and testing data? Answer: Training data teaches the model; testing data evaluates it on unseen examples.")}>Generate quiz <span>→</span></button></div>
        <div className="ai-result"><span>✦</span><p>{aiResult}</p></div><Link href="/ai-tutor">Open full AI tutor →</Link>
      </aside>
    </div>
    {showNote&&<div className="modal-backdrop" onMouseDown={()=>setShowNote(false)}><form className="topic-modal note-modal" onSubmit={addNote} onMouseDown={e=>e.stopPropagation()}><button type="button" className="modal-close" onClick={()=>setShowNote(false)}>×</button><div className="eyebrow"><span>✦</span> CAPTURE AN IDEA</div><h2>Add a new note</h2><p>Write it in your own words so it is easier to remember.</p><label>Note title<input autoFocus value={noteTitle} onChange={e=>setNoteTitle(e.target.value)} placeholder="e.g. Model evaluation"/></label><label>Note content<textarea value={noteBody} onChange={e=>setNoteBody(e.target.value)} rows={5} placeholder="Write your note here..."/></label><button className="button button-primary" type="submit">Save note <span>→</span></button></form></div>}
  </PageShell>;
}

const history = [
  { day: "Today", sessions: [{icon:"◎",title:"Machine Learning Basics",action:"Reviewed 3 notes",time:"42 min",type:"Study session"},{icon:"✦",title:"AI Tutor",action:"Generated a practice quiz",time:"12 min",type:"AI activity"}]},
  { day: "Yesterday", sessions: [{icon:"⌘",title:"Python Fundamentals",action:"Added 2 notes",time:"35 min",type:"Study session"},{icon:"◫",title:"Backend APIs",action:"Summarized topic notes",time:"18 min",type:"AI activity"}]},
  { day: "July 23", sessions: [{icon:"◇",title:"Neural Networks",action:"Created a new topic",time:"24 min",type:"Study session"}]},
];

export function HistoryPage() {
  return <PageShell title="Study history" subtitle="A clear record of the time and effort you invest in learning.">
    <div className="history-stats"><article><small>THIS WEEK</small><strong>8h 30m</strong><span>+18% from last week</span></article><article><small>SESSIONS</small><strong>14</strong><span>Across 4 topics</span></article><article><small>LONGEST SESSION</small><strong>1h 12m</strong><span>Machine Learning</span></article></div>
    <div className="history-layout"><section className="history-timeline">{history.map(group=><div className="history-day" key={group.day}><h2>{group.day}</h2>{group.sessions.map(s=><article key={s.title+s.action}><span className="history-icon">{s.icon}</span><div><h3>{s.title}</h3><p>{s.action} · {s.type}</p></div><b>{s.time}</b></article>)}</div>)}</section>
      <aside className="history-side"><div className="section-head"><div><h3>Weekly rhythm</h3><p>Your focused minutes</p></div><b>8h 30m</b></div><div className="large-week-bars">{[42,65,38,78,55,88,28].map((h,i)=><div key={i}><i style={{height:`${h}%`}} className={i===5?"today":""}/><span>{"MTWTFSS"[i]}</span></div>)}</div><p className="history-note">You study best on <b>Saturday mornings</b>. Keep protecting that time.</p></aside>
    </div>
  </PageShell>;
}

export function TutorPage() {
  const [messages,setMessages]=useState([{role:"assistant",text:"Hi Maya! I’m ready to help. Choose a topic or ask me anything you’re studying."}]);
  const [input,setInput]=useState("");
  function send(e:FormEvent){e.preventDefault();if(!input.trim())return;const q=input.trim();setInput("");setMessages(m=>[...m,{role:"user",text:q},{role:"assistant",text:"Great question. Supervised learning is like learning with an answer key: a model studies labeled examples, notices patterns, and uses them to predict labels for new examples."}]);}
  function prompt(text:string){setInput(text);}
  return <PageShell title="AI tutor" subtitle="Ask questions, simplify ideas, and turn your notes into active practice.">
    <div className="tutor-layout"><section className="chat-panel"><div className="chat-heading"><span className="ai-spark">✦</span><div><h2>Studia Tutor</h2><p><i /> Online · Focused on Machine Learning Basics</p></div><button>Change topic</button></div>
      <div className="chat-messages">{messages.map((m,i)=><div className={`chat-message ${m.role}`} key={i}>{m.role==="assistant"&&<span>✦</span>}<p>{m.text}</p></div>)}</div>
      <div className="quick-prompts"><button onClick={()=>prompt("Summarize my notes")}>Summarize notes</button><button onClick={()=>prompt("Explain this simply")}>Explain simply</button><button onClick={()=>prompt("Create a 5 question quiz")}>Generate quiz</button></div>
      <form className="chat-input" onSubmit={send}><textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Ask your tutor a question..." rows={2}/><button type="submit">Send <span>→</span></button></form>
    </section><aside className="tutor-context"><div className="section-kicker">CURRENT CONTEXT</div><span className="topic-icon purple">◎</span><h3>Machine Learning Basics</h3><p>8 notes are available to help the tutor answer your questions.</p><div className="context-list"><span>✓ Uses your selected topic</span><span>✓ References your notes</span><span>✓ Keeps answers beginner-friendly</span></div><button>View topic notes</button></aside></div>
  </PageShell>;
}

export function SettingsPage() {
  const [saved,setSaved]=useState(false); const [theme,setTheme]=useState("Light");
  return <PageShell title="Settings" subtitle="Manage your profile, study preferences, and notifications.">
    {saved&&<div className="save-toast">✓ Your settings have been saved.</div>}
    <div className="settings-layout"><nav className="settings-nav"><button className="active">Profile</button><button>Study preferences</button><button>Notifications</button><button>Account & privacy</button></nav>
      <section className="settings-panel"><div className="settings-section"><div><h2>Profile information</h2><p>Update the details shown in your Studia account.</p></div><div className="profile-photo"><span className="avatar large">MA</span><button>Change photo</button></div><div className="settings-form"><label>Full name<input defaultValue="Maya Ahmed"/></label><label>Email address<input type="email" defaultValue="maya@example.com"/></label><label className="full">Learning goal<textarea defaultValue="Build strong foundations in machine learning and backend development." rows={3}/></label></div></div>
      <div className="settings-section"><div><h2>Appearance</h2><p>Choose how Studia looks on this device.</p></div><div className="theme-options">{["Light","System","Dark"].map(x=><button className={theme===x?"active":""} onClick={()=>setTheme(x)} key={x}><i className={x.toLowerCase()}/><span>{x}</span>{theme===x&&<b>✓</b>}</button>)}</div></div>
      <div className="settings-section"><div><h2>Email notifications</h2><p>Control the study reminders sent to your inbox.</p></div><label className="toggle-row"><span><b>Weekly study summary</b><small>Progress, activity, and your next suggested topic.</small></span><input type="checkbox" defaultChecked/></label><label className="toggle-row"><span><b>Study streak reminder</b><small>A gentle reminder when your streak is at risk.</small></span><input type="checkbox" defaultChecked/></label></div>
      <div className="settings-actions"><button onClick={()=>setSaved(true)} className="button button-primary">Save changes</button></div></section>
    </div>
  </PageShell>;
}
