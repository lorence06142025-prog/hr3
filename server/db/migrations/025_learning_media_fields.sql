-- 025_learning_media_fields.sql
ALTER TABLE learning_resources
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS lesson_content TEXT;
