'use client'

import { useEffect, useMemo, useState } from 'react'
import { api, messageFromError } from '../lib/api'

type Plan = { plan:string; label:string; monthlyPriceUsd:number; storageBytes:number; monthlyRequestLimit:number; featureLimits:Record<string,{monthly?:number;daily?:number}> }
type FeatureUsage = { monthlyUsed?:number; monthlyLimit?:number; dailyUsed?:number; dailyLimit?:number; softLimitHit?:boolean }
type Usage = { used:number; limit:number; remaining:number; softLimitHit:boolean; features:Record<string,FeatureUsage> }
type Tab = 'overview' | 'usage' | 'invoices'

export default function Billing() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api<Plan>('/plans/me'), api<Usage>('/usage/me')])
      .then(([nextPlan,nextUsage]) => { setPlan(nextPlan); setUsage(nextUsage) })
      .catch(reason => setError(messageFromError(reason)))
  }, [])

  const features = useMemo(() => {
    if (!plan) return []
    const names:Record<string,string> = { chat:'AI tutor messages',flashcards:'AI flashcard generation',quiz:'AI quiz generation',coach:'Study coach plans',workspace_ai:'Workspace AI',knowledge_graph:'Knowledge graph',mind_map:'Mind maps' }
    return Object.entries(plan.featureLimits).map(([key, limits]) => {
      const cap = limits.monthly ? `${limits.monthly} / month` : limits.daily ? `${limits.daily} / day` : 'Included'
      return `${names[key] ?? key.replaceAll('_',' ')} · ${cap}`
    })
  }, [plan])

  if (error) return <State text={error}/>
  if (!plan || !usage) return <State text="Loading billing & plan…"/>

  return <main className="billing-page">
    <header className="billing-heading"><h1>Billing &amp; plan</h1><p>Manage your plan, usage, and account limits.</p></header>

    <section className="plan-hero">
      <div><span className="eyebrow">CURRENT PLAN</span><div className="plan-name"><h2>{plan.label}</h2><strong>${plan.monthlyPriceUsd.toFixed(plan.monthlyPriceUsd % 1 ? 2 : 0)}</strong><span>/ month</span></div><p>{plan.monthlyRequestLimit.toLocaleString()} AI requests per month · {(plan.storageBytes/1024/1024).toFixed(0)} MB storage</p></div>
      <div className="plan-actions"><button disabled>Manage payment</button><span>Billing portal unavailable</span></div>
    </section>

    <nav className="billing-tabs" aria-label="Billing sections">
      <button className={tab==='overview'?'active':''} onClick={() => setTab('overview')}>Plan overview</button>
      <button className={tab==='usage'?'active':''} onClick={() => setTab('usage')}>Usage</button>
      <button className={tab==='invoices'?'active':''} onClick={() => setTab('invoices')}>Invoices</button>
    </nav>

    {tab === 'overview' && <>
      <section className="overview-grid">
        <article className="panel feature-panel"><h3>{plan.label} plan includes</h3><ul>{features.length ? features.map(item => <li key={item}><i>✓</i><span>{item}</span></li>) : <li><i>✓</i><span>Core study tools</span></li>}<li><i>✓</i><span>Mistake notebook and analytics</span></li><li><i>✓</i><span>Workspace editor</span></li></ul></article>
        <article className="panel limits-panel"><span className="blue-eyebrow">YOUR ALLOWANCE</span><h2>{plan.monthlyRequestLimit.toLocaleString()} requests</h2><p>Your AI usage allowance resets monthly. Usage covers the tutor and content-generation features.</p><div className="price-row"><strong>{usage.remaining.toLocaleString()}</strong><span> requests remaining</span></div><button onClick={() => setTab('usage')}>View detailed usage →</button></article>
      </section>
      <aside className="discount-banner"><span className="discount-icon">🎓</span><div><strong>Student-ready study tools</strong><p>Your current account already includes all features available for the {plan.label} plan.</p></div><button onClick={() => setTab('usage')}>Check usage →</button></aside>
    </>}

    {tab === 'usage' && <UsagePanel usage={usage}/>} 
    {tab === 'invoices' && <section className="panel invoices-empty"><div>🧾</div><h2>No invoices available</h2><p>Payment processing and invoice history are not enabled by the backend yet.</p></section>}

    <style>{`
      .billing-page{padding:40px 32px 80px;max-width:1135px;margin:0 auto;color:var(--color-text)}.billing-heading{margin-bottom:42px}.billing-heading h1{font:700 40px/1.1 'Fraunces',Georgia,serif;letter-spacing:-.025em;margin:0 0 14px}.billing-heading p{font-size:17px;color:var(--color-text-muted);margin:0}
      .plan-hero{min-height:204px;box-sizing:border-box;padding:39px 42px;border-radius:27px;background:radial-gradient(circle at 90% 5%,rgba(109,94,246,.25),transparent 30%),linear-gradient(120deg,#201a39,#171710);color:#fff;display:flex;justify-content:space-between;align-items:center;gap:30px}.eyebrow,.blue-eyebrow{display:block;color:#8b7cff;font-size:13px;font-weight:800;letter-spacing:.08em;margin-bottom:19px}.plan-name{display:flex;align-items:baseline;gap:9px}.plan-name h2{font:700 40px 'Fraunces',serif;margin:0}.plan-name strong{color:#b7afc5;font-size:17px}.plan-name span,.plan-hero p{color:#aaa2b4}.plan-hero p{margin:13px 0 0}.plan-actions{display:flex;align-items:center;gap:20px}.plan-actions button{padding:16px 27px;border:1px solid #6654d3;border-radius:13px;background:#312653;color:#a99cff;font-weight:700;font-size:15px}.plan-actions span{color:#77717c;font-size:13px}
      .billing-tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:35px 0;padding:6px;border:1px solid var(--color-border);border-radius:17px;background:var(--color-surface)}.billing-tabs button{padding:15px;border:0;border-radius:12px;background:transparent;color:var(--color-text-muted);font:500 15px 'Outfit',sans-serif;cursor:pointer}.billing-tabs button.active{background:var(--color-bg);box-shadow:inset 0 0 0 1px var(--color-border);color:var(--color-text);font-weight:700}
      .overview-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.panel{border:1px solid var(--color-border);border-radius:23px;background:var(--color-surface);padding:32px;color:var(--color-text)}.panel h3{font-size:16px;margin:0 0 24px}.feature-panel ul{list-style:none;padding:0;margin:0}.feature-panel li{display:flex;align-items:center;gap:13px;margin:14px 0;font-size:15px;text-transform:capitalize}.feature-panel i{width:25px;height:25px;border-radius:50%;display:grid;place-items:center;background:rgba(90,181,142,.14);color:#5ab58e;font-style:normal;font-weight:800}.blue-eyebrow{color:#3d91af;margin:0 0 22px}.limits-panel h2{font:700 31px 'Fraunces',serif;margin:0 0 17px}.limits-panel p{color:var(--color-text-muted);line-height:1.7;margin:0;max-width:470px}.price-row{margin:55px 0 23px}.price-row strong{font:700 38px 'Fraunces',serif}.price-row span{color:var(--color-text-muted)}.limits-panel button{width:100%;padding:15px;border-radius:13px;border:1px solid rgba(61,145,175,.3);background:rgba(61,145,175,.1);color:#3d91af;font-weight:700;cursor:pointer}
      .discount-banner{margin-top:24px;padding:25px 36px;border:1px solid rgba(109,94,246,.25);border-radius:21px;background:rgba(109,94,246,.07);display:flex;align-items:center;gap:22px}.discount-icon{font-size:28px}.discount-banner div{flex:1}.discount-banner strong{font-size:16px}.discount-banner p{margin:6px 0 0;color:var(--color-text-muted);font-size:14px}.discount-banner button{border:0;background:transparent;color:#6d5ef6;font-weight:700;cursor:pointer}
      .usage-panel{display:grid;grid-template-columns:280px 1fr;gap:24px}.usage-total{text-align:center}.usage-total h2{font:700 44px 'Fraunces',serif;margin:20px 0 5px}.usage-total p{color:var(--color-text-muted)}.usage-bar,.feature-bar{height:9px;border-radius:8px;background:var(--color-surface-2);overflow:hidden}.usage-bar i,.feature-bar i{display:block;height:100%;background:#6d5ef6;border-radius:8px}.feature-usage{padding:16px 0;border-bottom:1px solid var(--color-border)}.feature-usage>div{display:flex;justify-content:space-between;margin-bottom:9px}.feature-usage small{color:var(--color-text-muted)}.invoices-empty{text-align:center;padding:75px 30px}.invoices-empty>div{font-size:38px}.invoices-empty h2{font:700 27px 'Fraunces',serif}.invoices-empty p{color:var(--color-text-muted)}
      @media(max-width:760px){.billing-page{padding:26px 16px 80px}.billing-heading h1{font-size:33px}.plan-hero{padding:30px 24px;display:block}.plan-actions{margin-top:26px}.overview-grid,.usage-panel{grid-template-columns:1fr}.billing-tabs button{font-size:13px;padding:12px 5px}.discount-banner{align-items:flex-start;padding:22px;flex-wrap:wrap}.discount-banner button{margin-left:45px}.plan-name h2{font-size:34px}}
    `}</style>
  </main>
}

function UsagePanel({usage}:{usage:Usage}) { const totalPercent=Math.min(100,usage.used/Math.max(1,usage.limit)*100); return <section className="usage-panel"><article className="panel usage-total"><span className="blue-eyebrow">MONTHLY USAGE</span><h2>{usage.used.toLocaleString()}</h2><p>of {usage.limit.toLocaleString()} requests</p><div className="usage-bar"><i style={{width:`${totalPercent}%`}}/></div><p>{usage.remaining.toLocaleString()} remaining</p></article><article className="panel"><h3>Usage by feature</h3>{Object.entries(usage.features).map(([name,value]) => {const used=value.monthlyUsed??value.dailyUsed??0,limit=value.monthlyLimit??value.dailyLimit??0,pct=Math.min(100,used/Math.max(1,limit)*100);return <div className="feature-usage" key={name}><div><strong>{name.replaceAll('_',' ')}</strong><small>{used} / {limit}</small></div><div className="feature-bar"><i style={{width:`${pct}%`}}/></div></div>})}</article></section> }
function State({text}:{text:string}) { return <main style={{minHeight:'60vh',display:'grid',placeItems:'center',color:'var(--color-text-muted)'}}>{text}</main> }
