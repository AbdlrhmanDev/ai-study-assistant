# Phase 1 — المتبقي والاستعداد اليدوي للنسخة التجريبية المغلقة

آخر تحديث: 11 أغسطس 2026 — بعد إكمال جميع أقسام Phase 1 الثمانية المستقلة عن الدومين (انظر `SAAS_TODO.md` للتفاصيل والاختبارات).

هذا الملف يشرح ما تبقى بعد مراجعة `SAAS_TODO.md`. لا يُعتبر أي إعداد خارجي مكتملًا لمجرد إنشاء الحساب أو الخدمة؛ يجب ربطه ببيئة الإنتاج والتحقق منه من داخل Studia.

## قرار ClamAV

تم تأجيل تشغيل ClamAV، وليس حذف دعمه من الكود. السبب أن خطة Railway الحالية تسمح بذاكرة 1 GB فقط، وهي غير مناسبة غالبًا لتحميل قاعدة توقيعات ClamAV وتشغيل `clamd` بصورة مستقرة.

الإعداد الحالي المطلوب:

```env
MALWARE_SCAN_REQUIRED=false
```

إجراءات تقليل المخاطر خلال الـ Closed Beta:

- السماح فقط بملفات PDF وTXT وMarkdown المدعومة.
- إبقاء فحص الامتداد، MIME signature، الحجم، وصلاحية UTF-8 مفعّلًا.
- قصر الدعوات على مستخدمين معروفين وعدم فتح التسجيل العام.
- إعادة تقييم ClamAV أو مزود فحص خارجي قبل الإطلاق العام.
- عند العودة إلى ClamAV: توفير 3–4 GB RAM، Volume لمسار `/var/lib/clamav`، اختبار ملف عادي، ثم اختبار EICAR قبل ضبط `MALWARE_SCAN_REQUIRED=true`.

## ملخص الحالة

### موجود برمجيًا ومُختبر (تم إنجازه في هذه الجولة)

- S3-compatible object storage، signed upload/download URLs، حذف idempotent، وcleanup job للـ abandoned uploads.
- سجل دائم لاستخدام AI وتكلفته التقديرية الحقيقية (من الاستخدام الفعلي للـ tokens، ليس تقديرًا ثابتًا).
- حدود شهرية/يومية منفصلة لكل feature فوق الحد الشهري العام، وتحذير soft-limit قبل الحد النهائي، ولوحة Admin usage/cost (`/admin`).
- Frontend error monitoring (`@sentry/react` + `ErrorBoundary`)، قياس database pool وslow queries، queue metrics، auth-failure metric، وتشديد الـ redaction.
- Postgres-backed `background_jobs`، idempotency keys للفهرسة والتوليد، recovery للمهام العالقة، ونقل Knowledge Graph وMind Map فعليًا إلى async job + polling. توليد Quiz/Exam/Flashcard بقي متزامنًا بقرار مؤكد، لكنه اكتسب حماية idempotency-key.
- Change password (مع إبطال الجلسات الأخرى)، عرض/إلغاء الجلسات مع عزل الملكية، حذف الحساب (retry-safe ويُختبر cascade كاملًا)، وتصدير كامل للبيانات (باستثناء الأسرار).
- ثلاث مهام تنظيف مجدولة (الجلسات المنتهية، الرفع المتروك، آثار AI) وكل واحدة تسجل `CleanupRun` بالعدّاد فقط دون محتوى.
- Command palette يبحث فعليًا عبر `/study-search` مع تنقّل بالأسهم، مع اكتشاف تعارض الحفظ في Workspace.
- **مراجعة إتاحة (accessibility) كاملة عبر axe-core:** تم إصلاح أزرار إغلاق بلا اسم قابل للنطق، عدة تباينات ألوان فعلية فشلت WCAG AA (تم تصحيحها وقياسها على العرض الفعلي وليس القيمة الاسمية فقط)، إغلاق بـ Escape لكل الـ dialogs عبر نقرة DOM حقيقية على زر الإغلاق (وليس حدثًا اصطناعيًا — النسخة السابقة من هذا سبّبت تجمّد الصفحة وتم التراجع عنها)، وإصلاح عطل سابق في استعادة التركيز (focus) بعد إغلاق أي نافذة. تفاصيل الاختبارات في `SAAS_TODO.md`.

### قيد الإعداد اليدوي والتحقق

- Cloudflare R2: الكود جاهز (بما فيه signed URLs)، لكن لا يُغلق البند حتى تُضاف مفاتيح الإنتاج الفعلية إلى Railway وينجح الرفع والتنزيل والحذف بعد إعادة نشر الخادم، وتُنشأ lifecycle policy فعلية على الـ bucket.
- Redis: يجب إنشاء الخدمة أو قاعدة Redis Cloud، إضافة `REDIS_URL`، نشر Worker (الخطوات موثقة في `backend/PRODUCTION.md`)، ثم إثبات أن مهمة فهرسة تبقى بعد إعادة تشغيل Backend.
- Sentry: الكود يدعم DSN لكل من Backend وFrontend (`SENTRY_DSN`، `NEXT_PUBLIC_SENTRY_DSN`)؛ إنشاء المشاريع الفعلية والتنبيهات لا يزال يدويًا.
- ClamAV: مؤجل كما هو موضح أعلاه.

## أولًا: الإعدادات اليدوية المتبقية

هذه المهام تحتاج حسابات أو قرارات أو إعدادات في لوحات خارجية، ولا يستطيع الكود تنفيذها وحده.

### 1. إكمال Cloudflare R2

- إنشاء Bucket خاص باسم `studia-production-uploads`.
- إنشاء Token محدود بالـ Bucket وبصلاحية Object Read & Write.
- إضافة القيم إلى Railway Backend:

```env
STORAGE_BACKEND=s3
S3_BUCKET=studia-production-uploads
S3_REGION=auto
S3_ENDPOINT_URL=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=secret
S3_SECRET_ACCESS_KEY=secret
SIGNED_URL_TTL_SECONDS=900
```

- عدم جعل الـ Bucket عامًا.
- إضافة lifecycle policy للملفات المؤقتة بعد تحديد prefixes التي سيستخدمها cleanup job.
- اختبار upload، download، delete، ثم إعادة نشر Backend والتأكد أن الملف باقٍ.

الحالة: **قيد الإعداد اليدوي**.

### 2. إكمال Redis والـ Worker

- إنشاء Redis داخل Railway أو Redis Cloud.
- إضافة `REDIS_URL` إلى Backend والـ Worker.
- إضافة:

```env
JOB_QUEUE_NAME=studia:jobs
JOB_MAX_RETRIES=4
```

- نشر Worker كخدمة مستقلة باستخدام نفس كود Backend ومتغيراته.
- إبقاء Redis على شبكة خاصة عندما يكون داخل Railway.
- اختبار queue وdead-letter behavior وإعادة تشغيل الخدمات أثناء مهمة جارية.

الحالة: **تحتاج إعدادًا يدويًا واختبار تكامل**.

### 3. ضبط ميزانية ومفاتيح AI

- اختيار مزود Production الأساسي ومزود fallback.
- إنشاء مفاتيح Production منفصلة عن Development.
- وضع spending limits وتنبيهات billing داخل لوحة كل مزود.
- تحديد حد beta واقعي:

```env
AI_MONTHLY_REQUEST_LIMIT=300
ADMIN_EMAILS=admin@example.com
```

- تحديد حدود document indexing والـ embeddings، لأنها البند الوحيد غير المحدد ضمن قائمة الميزات المكلفة.

الحالة: **قرار وإعداد يدوي، ثم تطوير per-feature enforcement**.

### 4. إعداد Sentry ومراقبة الأخطاء

- إنشاء مشروع Backend ومشروع Frontend منفصلين.
- إضافة `SENTRY_DSN` للـ Backend.
- إنشاء وتنفيذ DSN للواجهة عند إضافة تكامل Frontend.
- إعداد alerts لأخطاء 5xx، latency، Redis، queue backlog، AI failures، retries، والتكلفة.
- التأكد أن prompts والملاحظات والأسرار وcookies لا تُرسل إلى Sentry.

الحالة: **Backend وFrontend يدعمان DSN (`@sentry/react` مع `ErrorBoundary` جاهز في الكود)؛ إنشاء المشاريع الفعلية وربط الـ DSN الحقيقي وإعداد التنبيهات لا يزال يدويًا**.

### 5. إعداد Uptime Monitoring

- اختيار Better Stack أو UptimeRobot أو Sentry Monitoring.
- إضافة checks لـ:

```text
https://APP_DOMAIN/
https://API_DOMAIN/health
https://API_DOMAIN/health/ready
```

- توجيه التنبيهات إلى بريد الإدارة.
- إنشاء synthetic journey لتسجيل الدخول وإنشاء Topic ثم تنظيف بيانات الاختبار.

الحالة: **إعداد يدوي، والـ synthetic check يحتاج script أو monitor configuration**.

### 6. اختيار مزود البريد وربط DNS

- اختيار Resend أو مزود transactional email آخر.
- إنشاء subdomain مثل `updates.example.com`.
- إضافة SPF وDKIM وMX والتحقق منها.
- إنشاء API key محدود للإرسال.
- تحديد From وSupport addresses.
- مراقبة bounce، complaint، وdelivery rate.

الحالة: **تحتاج إعدادًا يدويًا أولًا، ثم تنفيذ account lifecycle والبريد في الكود**.

### 7. تعبئة سجل Vendors/Subprocessors

- تسجيل المزود الفعلي لكل من hosting، database، Redis، storage، AI، email، monitoring، analytics، وbilling.
- لكل مزود: نوع البيانات، الغرض، مكان المعالجة، retention، رابط Privacy Policy، رابط DPA، وطريقة الحذف.
- تحديث Privacy Policy إذا اختلف الواقع عن النص المنشور.

الحالة: **يدوي وقانوني/تشغيلي**.

### 8. تشغيل Closed Beta

- تحديد 10–30 مستخدمًا معروفًا بدل فتح التسجيل العام.
- إنشاء قناة دعم ونموذج feedback.
- تحديد مسؤول للاستجابة للحوادث والطلبات القانونية.
- الاتفاق على cadence أسبوعي لمراجعة الأعطال، تكلفة AI، فشل الفهرسة، والاقتراحات.
- توثيق rollback وإيقاف الدعوات عند وجود فقد بيانات أو تجاوز تكاليف.

الحالة: **إداري يدوي**.

## ثانيًا: التطوير البرمجي المتبقي

معظم بنود هذا القسم أُنجزت واختُبرت في هذه الجولة (التفاصيل والاختبارات في `SAAS_TODO.md`). المتبقي فعليًا هو:

### Object storage والرفع

- إنشاء lifecycle policy فعلية على bucket R2 نفسه (الكود يستخدم prefixes منفصلة `documents/`، `tmp/`، `pending-deletion/` جاهزة لذلك، لكن الإعداد على لوحة R2 يدوي).

### AI usage والتكلفة

- إضافة alerts فعلية (قناة تنبيه مثل Slack/Email) لتجاوزات التكلفة أو الفشل المتكرر — المقاييس والـ dashboard موجودان، لا يوجد نظام تنبيه نشط بعد.

### Observability

- Distributed tracing كامل (spans عبر OpenTelemetry أو ما شابه) — الموجود حاليًا هو ربط correlation ID واحد عبر frontend → backend → job → استدعاء AI provider، وليس tracing كامل بالمعنى الدقيق.
- Synthetic login/create-topic check وuptime checks: **خارج نطاق هذه الجولة عمدًا** لأنها تحتاج دومينًا عامًا.

### Durable jobs

- نقل توليد Quiz/Exam/Flashcard إلى queue بالكامل: **قرار مؤكد بعدم النقل** — بقيت متزامنة لكن اكتسبت حماية idempotency-key ضد التكرار.
- نقل إرسال البريد إلى queue: غير قابل للتنفيذ الآن لعدم وجود مزود بريد مُفعّل (خارج النطاق، يحتاج دومينًا).

### Account lifecycle

- Email verification، Forgot password، Transactional email، وmagic link/OAuth: **خارج نطاق هذه الجولة عمدًا** لأنها تحتاج دومينًا وبريدًا فعليًا. باقي دورة الحساب (change password، عرض/إلغاء الجلسات، حذف الحساب، التصدير الكامل) منجز ومُختبر.

### Core UX

- تحديث Landing Page ليعكس Flashcards وExams وMind Map وKnowledge Graph — لم يُنفَّذ بعد.
- إكمال empty states الموحدة (`EmptyState`) في صفحات Exams وMind Map وKnowledge Graph — تعمل حاليًا بنمط أقدم يدوي وليس معطلة، لكنها غير موحدة بصريًا مع بقية التطبيق.

## ترتيب التنفيذ المقترح

بنود 3، 4 (جزئيًا)، 7، 8، و9 (باستثناء Landing Page وempty states) أصبحت **منجزة ومُختبرة برمجيًا**. المتبقي فعليًا إداري/يدوي بالكامل تقريبًا:

1. إكمال R2 والتحقق منه end-to-end. **(يدوي، متبقٍ)**
2. إكمال Redis ونشر Worker واختبار durability. **(يدوي، متبقٍ)**
3. ~~تنفيذ job idempotency قبل توسيع أنواع المهام.~~ **منجز ومُختبر.**
4. ~~ضبط limits منفصلة لـ AI وبناء monitoring للتكلفة.~~ **منجز ومُختبر** — التنبيهات الفعلية (alerting) لا تزال متبقية.
5. إعداد مشاريع Sentry الفعلية وuptime alerts. **(يدوي، متبقٍ — الكود يدعم DSN لكلا الطرفين)**
6. اختيار مزود البريد وربط DNS. **(يدوي، متبقٍ، خارج نطاق هذه الجولة عمدًا)**
7. ~~تنفيذ account lifecycle كاملًا.~~ **منجز ومُختبر** فيما لا يحتاج بريدًا (change password، الجلسات، الحذف، التصدير).
8. ~~تنفيذ export/delete بما يطابق السياسات.~~ **منجز ومُختبر.**
9. ~~إكمال رفع الملفات وaccessibility.~~ **منجز ومُختبر** — باستثناء تحديث Landing Page وتوحيد empty states في Exams/Mind Map/Knowledge Graph.
10. تشغيل قبول مغلق مع مجموعة صغيرة ومراقبة يومية. **(إداري، متبقٍ — يعتمد على إكمال 1، 2، 5، 6 أولًا)**

## شروط إغلاق Phase 1

هذه هي شروط إغلاق Phase 1 **كاملة**، بما فيها البنود التي تحتاج دومينًا وبريدًا (تأكيد البريد) والمستبعدة عمدًا من جولة العمل الحالية. إغلاق الجولة الحالية لا يعني إغلاق Phase 1 نفسها.

- الملفات تبقى بعد redeploy ويمكن حذفها من DB وR2 معًا.
- jobs لا تضيع عند restart ولا تكرر البيانات أو التكلفة.
- كل AI call مكلف يُسجل ويخضع لحد مناسب.
- الأعطال المهمة تولد تنبيهًا قابلًا للتصرف.
- المستخدم يستطيع تأكيد بريده، استعادة حسابه، تغيير كلمة المرور، تصدير بياناته، وحذف حسابه دون تدخل يدوي في قاعدة البيانات.
- المستخدم الجديد يصل لأول نشاط دراسة مفيد دون مساعدة خارجية.
- السياسات المنشورة تطابق المزودين والتدفقات الفعلية.
- ClamAV أو بديل فحص محتوى مناسب يتم تفعيله قبل **الإطلاق العام**؛ وهو مؤجل خلال الـ Closed Beta المقيد فقط.
