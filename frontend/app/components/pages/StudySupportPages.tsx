"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCircle2, Layers, ListChecks, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { api, messageFromError } from "../../lib/api";
import { PageShell } from "../shared/PageChrome";
import { Badge, Button, Card, EmptyState, LoadingState, MasteryBar, StatCard } from "../ui";

export type Mistake = { id:string; sourceType:"quiz"|"exam"; sourceId:number; attemptId:number; topicId:number; topicTitle:string; activityTitle:string; concept:string; prompt:string; studentAnswer:string; correctAnswer:string; explanation:string; mistakeType:string|null; diagnosis:string|null; answeredAt:string };
type WeakConcept = { conceptId:number; conceptName:string; topicId:number; topicTitle:string; masteryScore:number };

export function MistakesPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [saved, setSaved] = useState<Set<string>>(new Set());
  useEffect(() => { api<{mistakes:Mistake[]}>("/mistakes").then((data) => setMistakes(data.mistakes)).catch((e) => setError(messageFromError(e))).finally(() => setLoading(false)); }, []);
  async function makeCard(item:Mistake) { await api(`/topics/${item.topicId}/flashcards`, { method:"POST", body:JSON.stringify({ question:item.prompt, answer:item.correctAnswer, explanation:item.explanation }) }); setSaved((current) => new Set(current).add(item.id)); }
  return <PageShell className="mistakes-page" title="Mistake notebook" subtitle="Turn every incorrect answer into your next learning opportunity.">
    {error && <p className="page-error">{error}</p>}{loading ? <LoadingState label="Collecting your recent mistakes…" /> : !mistakes.length ? <EmptyState Icon={CheckCircle2} title="No mistakes to review" description="Complete a quiz or exam and incorrect answers will appear here automatically." action={<Button href="/quizzes" variant="primary">Take a quiz</Button>} /> : <div className="mistake-list">
      {mistakes.map((item) => <Card className="mistake-card" key={item.id}>
        <div className="mistake-head"><div><Badge tone={item.sourceType === "quiz" ? "accent" : "info"}>{item.sourceType}</Badge><Badge>{item.topicTitle}</Badge></div><time dateTime={item.answeredAt}>{new Date(item.answeredAt).toLocaleDateString()}</time></div>
        <h2>{item.prompt}</h2><p className="mistake-concept">{item.concept} · {item.activityTitle}</p>
        <div className="mistake-answer-grid"><div className="wrong"><small>Your answer</small><strong>{item.studentAnswer}</strong></div><div className="correct"><small>Correct answer</small><strong>{item.correctAnswer}</strong></div></div>
        <div className="mistake-explanation"><strong>Why</strong><p>{item.diagnosis || item.explanation}</p></div>
        <div className="mistake-actions"><Button href={`/ai-tutor?topicId=${item.topicId}&question=${encodeURIComponent(`Help me understand this mistake: ${item.prompt}`)}`} variant="secondary"><MessageCircle size={16}/> Ask tutor</Button><Button variant="secondary" disabled={saved.has(item.id)} onClick={() => void makeCard(item)}><Layers size={16}/>{saved.has(item.id) ? "Flashcard saved" : "Make flashcard"}</Button><Button href={`/quizzes/topic?topicId=${item.topicId}&practice=weak_areas`} variant="primary"><Sparkles size={16}/> Try similar</Button></div>
      </Card>)}
    </div>}
  </PageShell>;
}

type WeeklyReport = { periodStart:string; periodEnd:string; totalActivities:number; activeDays:number; quizSessions:number; flashcardReviews:number; aiQuestions:number; dailyActivity:{date:string;activities:number}[]; overdueFlashcards:number; weakConcepts:WeakConcept[]; recentMistakes:Mistake[]; recommendation:string };
export function WeeklyReportPage() {
  const [report,setReport]=useState<WeeklyReport|null>(null); const [error,setError]=useState("");
  useEffect(()=>{api<WeeklyReport>("/weekly-report").then(setReport).catch((e)=>setError(messageFromError(e)));},[]);
  return <PageShell title="Weekly report" subtitle="A clear view of your progress and the best next step.">{error&&<p className="page-error">{error}</p>}{!report?<LoadingState label="Preparing your weekly report…"/>:<>
    <div className="report-period"><CalendarDays size={18}/><span>{new Date(report.periodStart).toLocaleDateString()} – {new Date(report.periodEnd).toLocaleDateString()}</span></div>
    <div className="report-stats"><StatCard label="Study activity" value={report.totalActivities} detail="actions this week" Icon={TrendingUp} tone="accent"/><StatCard label="Active days" value={`${report.activeDays}/7`} Icon={CalendarDays}/><StatCard label="Quiz sessions" value={report.quizSessions} Icon={ListChecks} tone="info"/><StatCard label="Cards reviewed" value={report.flashcardReviews} Icon={Layers} tone="success"/></div>
    <Card className="report-recommendation"><span><Sparkles size={20}/></span><div><small>RECOMMENDED NEXT</small><h2>{report.recommendation}</h2></div><Button href={report.overdueFlashcards?"/flashcards":"/mistakes"} variant="primary">Start now <ArrowRight size={15}/></Button></Card>
    <div className="report-grid"><Card className="report-chart"><div className="section-head"><div><h2>Study rhythm</h2><p>Activity across the last seven days</p></div></div><div className="report-bars">{report.dailyActivity.map((day)=><div key={day.date}><span style={{height:`${Math.max(8,Math.min(100,day.activities*16))}%`}}/><strong>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined,{weekday:"short"})}</strong><small>{day.activities}</small></div>)}</div></Card><Card><div className="section-head"><div><h2>Weak concepts</h2><p>Focus on these first</p></div><Link href="/analytics">Analytics <ArrowRight size={13}/></Link></div><div className="report-weak">{report.weakConcepts.slice(0,5).map((item)=><MasteryBar key={`${item.topicId}-${item.conceptId}`} label={`${item.conceptName} · ${item.topicTitle}`} value={item.masteryScore}/>)}</div></Card></div>
  </>}</PageShell>;
}
