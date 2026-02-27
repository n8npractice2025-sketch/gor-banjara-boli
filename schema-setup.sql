-- Create sentences table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sentences (
  id integer primary key generated always as identity,
  sentence text not null
);

-- Create recordings table if it doesn't exist (minimal structure)
CREATE TABLE IF NOT EXISTS public.recordings (
  id uuid primary key default gen_random_uuid()
);

-- Safely add missing columns to recordings table without deleting existing data
ALTER TABLE public.recordings 
  ADD COLUMN IF NOT EXISTS sentence_id integer references public.sentences(id) on delete cascade on update cascade,
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS speech_to_text text,
  ADD COLUMN IF NOT EXISTS user_id uuid references auth.users(id) on delete cascade on update cascade,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS audio_format text,
  ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default timezone('utc'::text, now());

-- Insert sample sentences (will safely ignore duplicates)
INSERT INTO public.sentences (sentence) VALUES 
('నేను'),
('నువ్వు'),
('మనం'),
('ఇల్లు'),
('నీరు'),
('భోజనం'),
('పని'),
('పాఠశాల'),
('అమ్మ'),
('నాన్న'),
('పిల్ల'),
('వెళ్ళు'),
('రా'),
('తిను'),
('తాగు'),
('చూడు'),
('మాట్లాడు'),
('నిద్ర'),
('ఆడు'),
('కూర్చో'),
('నిలుచో'),
('ఇవ్వు'),
('తీసుకో'),
('చెప్పు'),
('విను')
ON CONFLICT DO NOTHING;


-- Set up Row Level Security (RLS)
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sentences ENABLE ROW LEVEL SECURITY;

-- Drop policies temporarily if they already exist, so we don't get 'already exists' errors
DROP POLICY IF EXISTS "Allow public read access to sentences" ON public.sentences;
DROP POLICY IF EXISTS "Allow authenticated users to insert recordings" ON public.recordings;
DROP POLICY IF EXISTS "Allow users to read their own recordings" ON public.recordings;

-- Recreate Policies cleanly
CREATE POLICY "Allow public read access to sentences" 
ON public.sentences FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to insert recordings" 
ON public.recordings FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to read their own recordings" 
ON public.recordings FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);
