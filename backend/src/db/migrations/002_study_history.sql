CREATE TABLE IF NOT EXISTS study_activities (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id BIGINT REFERENCES topics(id) ON DELETE SET NULL,
  activity_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT study_activities_type_check
    CHECK (activity_type IN (
      'topic_created',
      'topic_updated',
      'note_created',
      'note_updated',
      'note_moved',
      'ai_chat'
    )),
  CONSTRAINT study_activities_description_not_empty
    CHECK (CHAR_LENGTH(TRIM(description)) > 0)
);

CREATE INDEX IF NOT EXISTS study_activities_user_created_at_index
  ON study_activities (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS study_activities_topic_id_index
  ON study_activities (topic_id);
