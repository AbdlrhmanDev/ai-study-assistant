Studia — Product & UI/UX Design Brief

Studia — Product & UI/UX Design Brief
Purpose of this document: a self-contained brief for a designer or an AI UI/UX design tool to design or redesign Studia's interface. It covers the product idea, the people it's for, the full information architecture, a page-by-page UX spec, the current visual identity (to keep, evolve, or deliberately break from), and hard constraints. No prior context assumed.

1. The idea, in one paragraph
Studia is an AI study companion that turns whatever a student is learning — lecture notes, textbook PDFs, a syllabus — into a complete, connected study system. The student uploads or writes their material once, organized into topics; everything else (an AI tutor that actually knows the material, auto-generated flashcards and quizzes, a knowledge graph of concepts, a daily study plan, exam-readiness forecasts) is generated from that material and stays in sync with it. The product's core promise is coherence: instead of five disconnected study apps, one system that knows what you're weak on and routes you toward it — a flashcard you keep missing shows up in your coach's plan; a concept you got wrong on a quiz shows up red on your knowledge graph and gets a "ask the tutor about this" shortcut.

2. Positioning
Category: AI-native study/learning productivity tool — closer to "Notion + Anki + a tutor that read your notes" than to a generic chatbot wrapper.
Differentiator vs. a plain AI chatbot: grounding. Studia's tutor answers from the student's own material (RAG over their notes/documents), not generic web knowledge — and every other tool (quizzes, flashcards, knowledge graph) is generated from that same material, so it's all one coherent picture of one student's understanding, not five separate tools.
Differentiator vs. a plain flashcard/quiz app: it closes the loop. A wrong quiz answer doesn't just get marked wrong — it lowers a concept's mastery score, which resurfaces in the coach's next plan, the knowledge graph's coloring, and the mistake notebook.
Tone: calm, encouraging, competent — not gamified-loud, not corporate-sterile. Existing landing copy: "Learn smarter. Remember more." / "Study with clarity. Grow with confidence."
Business model direction: freemium/metered SaaS. A beta (free/limited) and pro tier already exist structurally (per-feature AI usage quotas, storage caps) — design should anticipate upgrade prompts and usage-limit UI (soft-limit warnings at ~80% of quota) as a first-class pattern, not an afterthought bolted on later.
3. Who it's for
Primary persona — the self-directed exam-prep student. University or professional-certification student (e.g., med/law/CS courses, board exams, technical certifications) juggling dense source material and a hard deadline (an exam date). Comfortable with digital tools, currently cobbling together separate apps (Notion for notes, Anki/Quizlet for flashcards, ChatGPT for questions, a spreadsheet for tracking). Wants: less setup friction, confidence that they're studying the right things as the exam approaches, less anxiety about blind spots. Primary emotional job: turn "I don't know what I don't know" into a concrete, prioritized plan.

Secondary persona — the curious self-learner. Learning a subject with no imposed deadline (a language, a new professional skill, a hobbyist technical topic). Less driven by exam-readiness forecasting, more by the tutor/chat and the satisfaction of watching a knowledge graph fill in and streaks build. Primary emotional job: momentum and a sense of visible progress.

Design for the exam-prep persona as primary — the exam-date/readiness/coach features are the product's sharpest edge — while keeping the everyday tools (tutor, flashcards, topics) equally strong for the self-learner who never sets a deadline.

4. Design principles to carry into any redesign
One system, not five tools. Every screen should visibly connect to the others — a weak concept should be one click from becoming a flashcard, a coach task, or a tutor question. Never let a tool feel like an isolated destination.
Show the "why," not just the score. Mastery percentages, exam-readiness labels, and quiz results should always be able to expand into why — a history of the signals that produced them. Confidence in an AI-scored product comes from transparency, not just a clean number.
Material-grounded, always visible. Anywhere the AI answers or generates something, it should be clear what it read to produce that answer (source chips, "based on your notes on X"). This is the product's core trust mechanic.
Calm density. Students using this under exam pressure need information-dense screens (stats, breakdowns, tables) that still feel calm, not alarming — reserve high-saturation/urgent color for genuinely urgent states (overdue reviews, "behind" exam status), not decoration.
Low-friction study loops. The actual study actions (review a flashcard, answer a quiz question, read a tutor answer) should have the least visual noise and fastest interaction path in the whole app — this is where the student spends the most time and should feel the least friction.
5. Information architecture
Primary navigation (11 items), grouped conceptually (grouping is a design opportunity — currently a flat list):

Orient: Overview (dashboard/home)
Organize: My topics, Workspace (free-form notes)
Study: Study coach, Flashcards, Quizzes, Exams, AI tutor
Reflect: Study history, Mistake notebook, Analytics
Plus: Settings, a global command palette (search everything + quick actions, keyboard-driven), and an admin-only usage dashboard.

Two organizing structures coexist and should be reconciled or clearly distinguished in a redesign:

Topic-scoped tools — flashcards, quizzes, exams, AI tutor, knowledge graph, and mind map are all per topic. The Topic Detail page acts as a hub: pick a topic, then pick a tool for that topic. This is the primary mental model.
Global/cross-topic views — the main nav's Flashcards/Quizzes/Exams/AI tutor entries, plus Coach, History, Mistakes, and Analytics, show an aggregate or "pick which topic" view across all topics.
A design opportunity: today tool #1 (topic hub) and tool #2 (global nav item) for the same feature (e.g. "Flashcards") are two different entry points into overlapping content — consider whether a redesign should unify these into one consistent pattern (e.g., global views are always "all topics, pick one to drill in" rather than a near-duplicate of the topic hub).

Sitemap:

/ (marketing landing, logged out)
├─ /register  /login  /forgot-password  /reset-password  /verify-email
├─ /dashboard  (home)
├─ /topics → /topic/{id}  (hub: tutor · quizzes · flashcards · exams · mind map · knowledge graph · notes+documents)
├─ /workspace → /workspace-page/{id}  (block editor, topic-optional)
├─ /coach  (daily plan, exam dates, readiness forecast)
├─ /flashcards → /deck/{id} → /review
├─ /quizzes → /topic/{id} → /take → /results  (+ /review for drafts before publish)
├─ /exams → /topic/{id} → /take → /results  (+ /review for drafts before publish)
├─ /ai-tutor  (chat: tutor / sparring / agents modes)
├─ /study-history
├─ /mistakes
├─ /weekly-report
├─ /analytics
├─ /admin  (admin-only, read-only dashboards)
├─ /settings
└─ /cookies  /privacy  /terms  (legal, logged out or in)
6. Page-by-page UX brief
For each page: the job it does, the primary user action, and what must be on screen. Use this as the functional spec — layout, hierarchy, and visual treatment are open to redesign.

Marketing landing (/)
Job: convert a visitor into a signup in one screen-length. Must have: a headline that states the core value prop in plain language, a visual that shows the product doing something concrete (not abstract), one primary CTA repeated at top and bottom, a short 3-point feature explanation, social proof. Logged-out only.

Auth (register / login / forgot / reset / verify)
Job: get a student into their account with minimal friction and zero anxiety about email verification blocking them. Must have: name/email/password fields with inline validation, a password visibility toggle, clear mode-switch link between login/register, a forgot-password link from login, and a verify-email flow that never blocks access — verification should read as a light nudge, not a gate. Keep this short and fast; this is not a place for heavy branding to slow the user down, though the current app pairs it with an inspirational/benefits panel — that's optional to keep.

Dashboard / Overview
Job: answer "what should I do right now?" in under 5 seconds of scanning. Must have: a personalized greeting, a small number of key stats (streak, topic count), a prioritized "needs your attention" section (overdue reviews, weakest concept, recent mistakes — each one click from action), a glance at today's coach plan, and quick access to recent topics. This page should never feel like a full dashboard with 15 widgets — ruthlessly prioritize the 3-4 things worth surfacing today.

Topics library
Job: browse and manage the student's subjects. Must have: search, create action, a card per topic (name, short description, last-updated, quick edit/delete), and a clear path into each topic's hub. Empty state matters a lot here — first-run users land here with nothing.

Topic hub (topic detail)
Job: the command center for one subject — pick a tool, see material, see progress at a glance. Must have: a tool switcher (tutor, quizzes, flashcards, exams, mind map, knowledge graph, notes/documents) that makes clear these all operate on the same underlying material; a notes/documents management area (upload, list, search, export) as the default/landing view; a compact progress signal (mastery/level) and a "weak concepts" list that deep-links into other tools. This is the most information-dense page in the product and deserves the most design attention — it's where the "one system" principle is most visible or most easily lost.

AI tutor (chat)
Job: get a trustworthy, material-grounded answer fast, with three distinct interaction modes:

Tutor mode — Q&A grounded in the topic's notes/documents. Must show source citations for answers, support asking about a specific uploaded document, support image upload (e.g. a photo of a textbook page or a diagram), and let the user rate answers.
Sparring mode — the AI deliberately argues a wrong claim about a concept the student names, and the student must catch and correct the error across a few turns; ends with a clear "you won" moment. This is a distinct, more playful/competitive interaction and should look and feel different from tutor mode, not just a mode toggle with identical chrome.
Agent mode — free-form requests ("quiz me," "make flashcards," "what should I study today") get routed to the right tool automatically, with an optional transparency view into how the request was interpreted. No streaming responses currently (answers arrive whole, not token-by-token) — design the loading/thinking state accordingly (a well-designed "thinking" state matters more here than a streaming-text treatment).
Workspace (block editor)
Job: free-form note-taking independent of the rigid topic/document model — a Notion-style canvas. Must have: a block-based editor supporting text, headings, lists, to-dos, toggles, quotes, callouts, code, images, embeds, and nested sub-pages; a slash command to insert blocks; drag-to-reorder; an in-editor "ask AI" affordance on any block; autosave with visible save-state; and an optional link to a topic (so its content feeds the AI tools). Should feel materially different from the rest of the app — more like a document, less like a dashboard.

Study coach
Job: answer "what should I study today, and am I going to be ready?" Must have: a narrative daily plan (a short list of time-boxed tasks pulled from weak concepts across all topics, each markable done/skipped, deep-linking to the relevant tool), a way to set an exam date and daily time budget per topic, and a readiness forecast per topic (a clear status — on track / at risk / behind / no data — with a one-line explanation, not just a number). This page carries real emotional weight for the exam-prep persona — treat the readiness states with care (reassuring when on track, motivating-not-panicking when behind).

Flashcards
Job: the fastest, lowest-friction review loop in the app. Deck list: due-today count, retention rate, next-review date, per deck. Deck management: manual add, AI-generate from topic/note/document, CSV import/export. Review screen: one card, front then reveal answer, then a 4-way confidence rating (forgot / hard / medium / easy) that schedules the next review — this rating interaction is the single most-repeated action in the product and deserves dedicated design polish (large touch targets, satisfying feedback, minimal chrome around the card itself).

Quizzes
Job: casual, lower-stakes practice with fast feedback. Generation: choose source (whole topic / a note / a document / a specific concept / "my past mistakes"), question types (multiple choice, true/false, short answer, fill-in-blank, matching, scenario), difficulty, count, optional timer, optional adaptive difficulty. Results: score, per-concept accuracy breakdown, an AI explanation of why a wrong answer was wrong, and a one-click "drill this" or "quiz me on my weak areas" follow-up. Should feel lighter-weight and more forgiving than exams.

Exams
Job: formal, higher-stakes, timed assessment mapped to depth-of-understanding levels (remember/understand/apply/analyze/evaluate/create), including free-response (essay/case-study/coding) questions graded against a rubric. Must have: a clear timer/deadline state, no mid-exam hints or feedback (unlike quizzes), and results that show rubric-level scoring with quoted evidence per criterion — this is the "prove you know it" tool, and its visual language should read as more serious/formal than quizzes even though they share a component family.

Knowledge graph
Job: give the student a spatial, explorable map of how concepts in a topic relate, colored by how well they know each one. Must have: an interactive node-link graph (drag, pan, zoom, search-to-highlight), color coding by mastery (weak → strong), and a detail panel on node click showing mastery history/"why this score" and connected concepts. This is a flagship visual feature — worth genuine design ambition (motion, color, spatial delight) rather than a generic force-directed-graph default.

Mind map
Job: a fast, readable outline of a topic's structure, generated automatically. Must have: a clear hierarchical tree (topic → sub-concepts → details), readable at a glance, exportable/shareable. Simpler and less interactive than the knowledge graph by design — this is a static-feeling overview, not an exploration tool.

Mistake notebook
Job: turn "I got this wrong" into "now I understand it." Must have: one card per mistake showing the question, the student's answer next to the correct one, a plain-language explanation of the error, and direct actions (ask the tutor about it, turn it into a flashcard, get a similar practice question).

Weekly report
Job: a periodic, motivating check-in. Must have: a short stats summary (study time, active days, quizzes taken, cards reviewed), one clear "recommended next step," a 7-day activity visualization, and a link into the weakest concepts.

Study history
Job: a trustworthy record of everything the student has done, for review or reassurance ("did I actually study this week?"). Must have: a chronological, day-grouped timeline, filters by activity type, and an exportable report.

Analytics
Job: the zoomed-out, cross-topic view of overall progress. Must have: top-line KPIs (this week's activity, streak, total XP, average mastery), a per-topic breakdown table, an activity trend chart, and a prioritized weak-concepts list.

Settings
Job: account control center. Must have: profile editing, notification/reminder preferences (including when — a preferred hour and threshold), appearance (dark mode), password/session management (see and revoke active sessions), a data export, and account deletion (must require re-authentication and communicate clearly what's being deleted). Also home to a learning-style profile — a visual (radar/spider chart) breakdown of how the student seems to learn best (visual/reading/practice/flashcards/examples/conversation), auto-detected but manually overridable — this is a distinctive, personality-giving feature worth a considered visual treatment, not a buried settings row.

Admin usage dashboard
Job: internal-only visibility into AI cost and reliability. Must have: usage/cost breakdowns by feature, provider, and user; failure rates; retention cohorts. Read-only, data-dense, can look more utilitarian/functional than the rest of the product — this is a tool for the team, not for students.

7. Gamification (cross-cutting)
XP, per-topic levels, and a daily streak run through nearly every graded interaction (a correct quiz answer, a flashcard review, winning a sparring round). Currently expressed as a toast/confetti moment on level-up and small stat cards on the dashboard/topic hub. Treat gamification as a seasoning, not the main flavor — it should create small moments of satisfaction without turning the product into a game-first experience that undercuts the "calm, competent study tool" positioning.

8. Current visual identity (evolve deliberately, don't discard by accident)
This is what exists today — useful as a starting point or an explicit thing to depart from, but not to be lost by default:

Brand name: Studia. Mark: a lowercase wordmark with a simple "s" glyph.
Palette: warm cream/off-white ground (#f7f5f1), a violet accent (#6d5ef6), full dark-mode variant (not a simple inversion — separately tuned).
Type: Inter (sans) for UI/body, Georgia (serif) for large display headings — an editorial sans/serif pairing that gives the product a slightly warmer, less generic-SaaS feel than an all-sans system. This pairing is one of the product's more distinctive existing choices and is worth preserving or intentionally reinterpreting rather than defaulting to a single generic sans across everything.
Shape language: consistently rounded (16px cards), soft shadows, calm and editorial rather than sharp/technical.
Iconography: lucide-react (a clean, consistent outline icon set).
Tone of voice: warm, direct, encouraging — "Learn smarter. Remember more.", "Study with clarity. Grow with confidence." No jargon, no hype language, no exclamation-point energy.
9. Hard constraints for any redesign
Mobile-first, fully responsive. A meaningful share of study sessions (flashcard review especially) happen on a phone; the bottom-nav/drawer pattern for mobile is a requirement, not a nice-to-have.
Full dark mode, not a token afterthought — many students study at night.
Accessibility: existing app maintains ~44px minimum touch targets, prefers-reduced-motion handling, and keyboard-navigable modals/command palette. Any redesign should hold or improve this bar (the team already runs automated a11y testing).
No token-by-token streaming assumption. AI responses currently arrive as a complete answer, not a live-typing stream — design loading/thinking states that don't presuppose streaming text.
Bilingual-aware: Arabic/RTL font support already exists; keep layouts RTL-adaptable where feasible (text direction, icon mirroring for directional icons).
Data-dense screens are unavoidable in several places (topic hub, admin, analytics, exam/quiz results) — prioritize information hierarchy and scannability over minimalism-for-its-own-sake on these specific screens, while keeping the study-action screens (flashcard review, chat, taking a quiz) as clean and low-friction as possible.
10. What "good" looks like for this redesign
A design that a stressed student mid-exam-prep opens at 11pm and immediately feels calmer, not more anxious — because it tells them clearly what to do next, shows them proof of progress, and never makes them hunt for the thing that matters. Every screen should answer, at a glance: what do I know, what don't I know, and what should I do about it.

This brief describes the product as it exists today (audited from the live codebase, 2026-08-12) plus explicit design opportunities. It is written to be handed directly to a designer or an AI design tool as a starting prompt — feel free to quote sections of it (e.g. §6 page briefs, §8 visual identity, §9 constraints) directly into a design-generation prompt.
