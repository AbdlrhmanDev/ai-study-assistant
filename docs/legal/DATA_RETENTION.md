# Data retention and subprocessors

- Active account and study data: retained until account deletion.
- Deleted relational data: deleted immediately through database cascades.
- Deleted uploads: removed with the document; reconcile orphaned objects daily.
- Application logs: 30 days; never log passwords, tokens, prompt bodies, or upload contents.
- Metrics: 13 months. Encrypted backups: 30 days. Dead-letter jobs: 14 days.

Before launch, record the legal entity, processing region, DPA link, and purpose for hosting, PostgreSQL, Redis, object storage, email, monitoring, and every AI/embedding provider.

Before serving schools or minors, complete COPPA/FERPA and applicable local review, define consent, sign school DPAs, and disable unapproved AI providers.
