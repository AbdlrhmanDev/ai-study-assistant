# AI Study Assistant — File Structure

```text
Project AI Study Assistant Website/
├── .gitignore
├── README.md
├── PROJECT_STRUCTURE.md
├── AI_Study_Assistant_Progress_and_Roadmap.docx
├── build_supervisor_report.py
│
├── backend/
│   ├── .env                       # Local secrets (not committed)
│   ├── .env.example               # Environment variable template
│   ├── .gitignore
│   ├── alembic.ini                # Alembic configuration
│   ├── Dockerfile
│   ├── PRODUCTION.md
│   ├── pyproject.toml
│   ├── README.md
│   ├── requirements.txt
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                # FastAPI application entry point
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── dependencies.py
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       └── router.py
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── exceptions.py
│   │   │   ├── logging.py
│   │   │   └── security.py
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── dependencies.py
│   │   │   └── session.py
│   │   │
│   │   ├── shared/
│   │   │   ├── __init__.py
│   │   │   ├── pagination.py
│   │   │   ├── responses.py
│   │   │   └── types.py
│   │   │
│   │   └── modules/
│   │       ├── __init__.py
│   │       ├── agents/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── ai/
│   │       │   ├── __init__.py
│   │       │   ├── chunking.py
│   │       │   ├── embedding.py
│   │       │   ├── exceptions.py
│   │       │   ├── indexing.py
│   │       │   ├── model.py
│   │       │   ├── provider.py
│   │       │   ├── rag.py
│   │       │   ├── repository.py
│   │       │   ├── retrieval.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   ├── service.py
│   │       │   ├── sparring.py
│   │       │   ├── storage.py
│   │       │   └── text_extraction.py
│   │       ├── analytics/
│   │       │   ├── __init__.py
│   │       │   ├── router.py
│   │       │   └── service.py
│   │       ├── auth/
│   │       │   ├── __init__.py
│   │       │   ├── dependencies.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── coach/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── ranking.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── exams/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── grading.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── export/
│   │       │   ├── __init__.py
│   │       │   ├── rendering.py
│   │       │   ├── router.py
│   │       │   └── service.py
│   │       ├── flashcards/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── scheduler.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── gamification/
│   │       │   ├── __init__.py
│   │       │   ├── leveling.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── rules.py
│   │       │   ├── service.py
│   │       │   └── streaks.py
│   │       ├── goal_prediction/
│   │       │   ├── __init__.py
│   │       │   ├── prediction.py
│   │       │   ├── router.py
│   │       │   └── service.py
│   │       ├── knowledge_graph/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   └── service.py
│   │       ├── learning_style/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   ├── scoring.py
│   │       │   └── service.py
│   │       ├── mastery/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── scoring.py
│   │       │   └── service.py
│   │       ├── memory/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── indexing.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── mind_map/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── service.py
│   │       │   └── structure.py
│   │       ├── notes/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── quizzes/
│   │       │   ├── __init__.py
│   │       │   ├── adaptive.py
│   │       │   ├── diagnosis.py
│   │       │   ├── exceptions.py
│   │       │   ├── grading.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       ├── study_history/
│   │       │   ├── __init__.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   └── service.py
│   │       ├── topics/
│   │       │   ├── __init__.py
│   │       │   ├── exceptions.py
│   │       │   ├── model.py
│   │       │   ├── repository.py
│   │       │   ├── router.py
│   │       │   ├── schema.py
│   │       │   └── service.py
│   │       └── users/
│   │           ├── __init__.py
│   │           ├── exceptions.py
│   │           ├── model.py
│   │           ├── repository.py
│   │           ├── router.py
│   │           ├── schema.py
│   │           └── service.py
│   │
│   ├── migrations/
│   │   ├── env.py
│   │   ├── README
│   │   ├── script.py.mako
│   │   └── versions/
│   │       ├── 32f652f45431_add_user_sessions.py
│   │       ├── 6566178cd69c_initial_schema.py
│   │       ├── a2c6f9e0d4b1_add_learning_style.py
│   │       ├── a30c5cd8f9a6_add_rag_tables.py
│   │       ├── a4f8c1e6d92a_add_study_coach.py
│   │       ├── a91c5d3e7f14_add_answer_diagnosis.py
│   │       ├── b41f7c92e3a1_add_flashcards.py
│   │       ├── b6f83a2e9c17_add_adaptive_quiz.py
│   │       ├── b7d3e5a9c142_add_mind_map.py
│   │       ├── c4e8f1a2b3d5_add_chat_with_images.py
│   │       ├── c58e2a917d3b_add_quizzes.py
│   │       ├── c7e2b9a15f34_add_exams.py
│   │       ├── d47a1e6f2b90_add_mastery.py
│   │       ├── d8a1e5c93b7f_add_gamification.py
│   │       ├── e58b3c9a1d02_add_student_memory.py
│   │       ├── e91f4a76b0c3_add_agents.py
│   │       ├── f27d94b6a3c5_add_sparring_mode.py
│   │       └── f3a8d21c6e97_add_knowledge_graph.py
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_agents.py
│   │   ├── test_ai_provider.py
│   │   ├── test_analytics.py
│   │   ├── test_auth.py
│   │   ├── test_coach.py
│   │   ├── test_exams.py
│   │   ├── test_export.py
│   │   ├── test_flashcards.py
│   │   ├── test_gamification.py
│   │   ├── test_goal_prediction.py
│   │   ├── test_knowledge_graph.py
│   │   ├── test_learning_style.py
│   │   ├── test_logging.py
│   │   ├── test_mastery.py
│   │   ├── test_memory.py
│   │   ├── test_mind_map.py
│   │   ├── test_notes.py
│   │   ├── test_quizzes.py
│   │   ├── test_rate_limiting.py
│   │   ├── test_study_history.py
│   │   └── test_topics.py
│   │
│   ├── docs/
│   │   └── architecture/
│   │       ├── architecture.html
│   │       ├── architecture.json
│   │       └── build_html.py
│   ├── uploads/                    # Runtime user uploads
│   ├── .venv/                     # Generated Python environment
│   ├── .pytest_cache/             # Generated test cache
│   └── .sparring_smoketest/       # Local smoke-test state
│
├── frontend/
│   ├── .env.example
│   ├── .gitignore
│   ├── .openai/
│   │   └── hosting.json
│   ├── eslint.config.mjs
│   ├── next.config.ts
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.mjs
│   ├── README.md
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   ├── vite.config.ts
│   │
│   ├── app/
│   │   ├── chatgpt-auth.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── ai-tutor/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── coach/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── exams/
│   │   │   ├── page.tsx
│   │   │   ├── results/page.tsx
│   │   │   ├── take/page.tsx
│   │   │   └── topic/page.tsx
│   │   ├── flashcards/
│   │   │   ├── page.tsx
│   │   │   ├── deck/page.tsx
│   │   │   └── review/page.tsx
│   │   ├── knowledge-graph/page.tsx
│   │   ├── login/page.tsx
│   │   ├── mind-map/page.tsx
│   │   ├── quizzes/
│   │   │   ├── page.tsx
│   │   │   ├── results/page.tsx
│   │   │   ├── take/page.tsx
│   │   │   └── topic/page.tsx
│   │   ├── register/page.tsx
│   │   ├── settings/page.tsx
│   │   ├── study-history/page.tsx
│   │   ├── topic/page.tsx
│   │   ├── topics/page.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   └── components/
│   │       ├── AnalyticsPages.tsx
│   │       ├── AppSidebar.tsx
│   │       ├── AuthForm.tsx
│   │       ├── BackendPages.tsx
│   │       ├── CoachPages.tsx
│   │       ├── Dashboard.tsx
│   │       ├── ExamPages.tsx
│   │       ├── FlashcardPages.tsx
│   │       ├── KnowledgeGraphPages.tsx
│   │       ├── MindMapPages.tsx
│   │       ├── QuizPages.tsx
│   │       └── StudyPages.tsx
│   │
│   ├── public/
│   │   ├── favicon.svg
│   │   ├── file.svg
│   │   ├── globe.svg
│   │   └── window.svg
│   ├── worker/
│   │   └── index.ts
│   ├── build/
│   │   └── sites-vite-plugin.ts
│   ├── examples/
│   │   └── d1/
│   │       ├── app/api/notes/route.ts
│   │       └── db/schema.ts
│   ├── tests/
│   │   └── rendered-html.test.mjs
│   ├── dist/                       # Generated production build
│   ├── outputs/                    # Generated deployment archives/stages
│   ├── .wrangler/                  # Generated Cloudflare local state
│   └── node_modules/               # Installed JavaScript dependencies
│
├── tmp/
│   └── pdfs/                       # Generated PDF page previews
├── .pnpm-store/                    # Local pnpm package cache
└── .idea/                          # Local IDE configuration
```

## Notes

- Generated dependency, cache, build, upload, and IDE internals are represented as
  directories rather than listing thousands of machine-created files.
- The local `backend/.env` file is intentionally identified but its contents are
  not documented because it may contain secrets.
- `backend/app/modules/` follows a feature-based architecture. Most feature
  modules separate API routing, schemas, models, repositories, services, and
  domain-specific logic.
