-- Fix database constraints for ThumbFrame schema

-- 1. Drop the unique constraint on user_email in the thumbnails table
ALTER TABLE public.thumbnails DROP CONSTRAINT IF EXISTS unique_user_email;
ALTER TABLE public.thumbnails DROP CONSTRAINT IF EXISTS thumbnails_user_email_key;

-- 2. Ensure the canvas_data column is jsonb
ALTER TABLE public.thumbnails
  ALTER COLUMN canvas_data TYPE jsonb USING canvas_data::jsonb;

-- Optional: Ensure 'id' is the primary key
-- ALTER TABLE public.thumbnails ADD PRIMARY KEY (id);