INSERT INTO study_activities (
  user_id,
  topic_id,
  activity_type,
  description,
  created_at
)
SELECT
  t.user_id,
  t.id,
  'topic_created',
  'Created topic: ' || t.title,
  t.created_at
FROM topics t;

INSERT INTO study_activities (
  user_id,
  topic_id,
  activity_type,
  description,
  created_at
)
SELECT
  t.user_id,
  n.topic_id,
  'note_created',
  'Created note: ' || n.title,
  n.created_at
FROM notes n
INNER JOIN topics t ON t.id = n.topic_id;

INSERT INTO study_activities (
  user_id,
  topic_id,
  activity_type,
  description,
  created_at
)
SELECT
  t.user_id,
  cm.topic_id,
  'ai_chat',
  'Asked AI tutor about: ' || t.title,
  cm.created_at
FROM chat_messages cm
INNER JOIN topics t ON t.id = cm.topic_id
WHERE cm.role = 'user';
