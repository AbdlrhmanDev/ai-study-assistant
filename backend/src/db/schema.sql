BEGIN;

-- =====================================================
-- 1. USERS TABLE
-- =====================================================

CREATE TABLE users (
                       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

                       name VARCHAR(100) NOT NULL,

                       email VARCHAR(255) NOT NULL,

    -- Never store the real password.
    -- Store a password hash generated with bcrypt or Argon2.
                       password_hash VARCHAR(255) NOT NULL,

                       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                       updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                       CONSTRAINT users_name_not_empty
                           CHECK (CHAR_LENGTH(TRIM(name)) >= 2),

                       CONSTRAINT users_email_not_empty
                           CHECK (CHAR_LENGTH(TRIM(email)) > 0)
);

-- Prevent duplicate emails, regardless of uppercase/lowercase.
-- Example: Test@email.com and test@email.com are treated as the same.
CREATE UNIQUE INDEX users_email_unique
    ON users (LOWER(email));


-- =====================================================
-- 2. TOPICS TABLE
-- =====================================================

CREATE TABLE topics (
                        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

                        user_id BIGINT NOT NULL,

                        title VARCHAR(200) NOT NULL,

                        description TEXT,

                        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                        CONSTRAINT topics_user_fk
                            FOREIGN KEY (user_id)
                                REFERENCES users(id)
                                ON DELETE CASCADE,

                        CONSTRAINT topics_title_not_empty
                            CHECK (CHAR_LENGTH(TRIM(title)) > 0)
);


-- =====================================================
-- 3. NOTES TABLE
-- =====================================================

CREATE TABLE notes (
                       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

                       topic_id BIGINT NOT NULL,

                       title VARCHAR(200) NOT NULL,

                       content TEXT NOT NULL,

                       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                       updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                       CONSTRAINT notes_topic_fk
                           FOREIGN KEY (topic_id)
                               REFERENCES topics(id)
                               ON DELETE CASCADE,

                       CONSTRAINT notes_title_not_empty
                           CHECK (CHAR_LENGTH(TRIM(title)) > 0),

                       CONSTRAINT notes_content_not_empty
                           CHECK (CHAR_LENGTH(TRIM(content)) > 0)
);


-- =====================================================
-- 4. CHAT MESSAGES TABLE
-- =====================================================

CREATE TABLE chat_messages (
                               id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

                               topic_id BIGINT NOT NULL,

                               role VARCHAR(20) NOT NULL,

                               message TEXT NOT NULL,

                               created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                               CONSTRAINT chat_messages_topic_fk
                                   FOREIGN KEY (topic_id)
                                       REFERENCES topics(id)
                                       ON DELETE CASCADE,

                               CONSTRAINT chat_messages_role_check
                                   CHECK (role IN ('user', 'assistant')),

                               CONSTRAINT chat_messages_message_not_empty
                                   CHECK (CHAR_LENGTH(TRIM(message)) > 0)
);

-- =====================================================
-- 5. STUDY ACTIVITIES TABLE
-- =====================================================

CREATE TABLE study_activities (
                                  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

                                  user_id BIGINT NOT NULL,

                                  topic_id BIGINT,

                                  activity_type VARCHAR(50) NOT NULL,

                                  description TEXT NOT NULL,

                                  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

                                  CONSTRAINT study_activities_user_fk
                                      FOREIGN KEY (user_id)
                                          REFERENCES users(id)
                                          ON DELETE CASCADE,

                                  CONSTRAINT study_activities_topic_fk
                                      FOREIGN KEY (topic_id)
                                          REFERENCES topics(id)
                                          ON DELETE SET NULL,

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


-- =====================================================
-- INDEXES
-- Improve database query performance
-- =====================================================

CREATE INDEX topics_user_id_index
    ON topics (user_id);

CREATE INDEX notes_topic_id_index
    ON notes (topic_id);

CREATE INDEX chat_messages_topic_id_index
    ON chat_messages (topic_id);

CREATE INDEX chat_messages_topic_created_at_index
    ON chat_messages (topic_id, created_at);

CREATE INDEX study_activities_user_created_at_index
    ON study_activities (user_id, created_at DESC);

CREATE INDEX study_activities_topic_id_index
    ON study_activities (topic_id);

COMMIT;
