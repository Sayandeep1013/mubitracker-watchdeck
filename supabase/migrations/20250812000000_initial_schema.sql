-- Watchdeck initial schema
-- Apply via Supabase SQL editor or `supabase db push`

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE media_format AS ENUM ('movie', 'series');
CREATE TYPE media_classification AS ENUM ('live_action', 'anime', 'documentary', 'animation');
CREATE TYPE privacy_level AS ENUM ('public', 'friends', 'private');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  profile_visibility privacy_level NOT NULL DEFAULT 'private',
  collection_visibility privacy_level NOT NULL DEFAULT 'friends',
  reviews_visibility privacy_level NOT NULL DEFAULT 'friends',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Media (global cache)
CREATE TABLE media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  format media_format NOT NULL,
  classification media_classification NOT NULL DEFAULT 'live_action',
  title TEXT NOT NULL,
  original_title TEXT NOT NULL DEFAULT '',
  overview TEXT NOT NULL DEFAULT '',
  release_date DATE,
  year INT,
  original_language TEXT NOT NULL DEFAULT 'en',
  poster_path TEXT,
  backdrop_path TEXT,
  runtime INT,
  popularity FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE media_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  UNIQUE(provider, external_id)
);

CREATE TABLE genres (
  id INT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE media_genres (
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  genre_id INT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (media_id, genre_id)
);

CREATE TABLE user_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('watched', 'unwatched')),
  review_status TEXT NOT NULL DEFAULT 'none' CHECK (review_status IN ('none', 'pending', 'written')),
  watched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, media_id)
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_spoiler BOOLEAN NOT NULL DEFAULT false,
  visibility privacy_level NOT NULL DEFAULT 'friends',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, media_id)
);

CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id != receiver_id),
  UNIQUE(requester_id, receiver_id)
);

CREATE TABLE filter_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_id UUID NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deck_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filter_config JSONB NOT NULL DEFAULT '{}',
  shown_media_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_media_external_ids_lookup ON media_external_ids(provider, external_id);
CREATE INDEX idx_user_media_user_status ON user_media(user_id, status);
CREATE INDEX idx_user_media_user_review ON user_media(user_id, review_status);
CREATE INDEX idx_media_year ON media(year);
CREATE INDEX idx_media_language ON media(original_language);
CREATE INDEX idx_media_classification ON media(classification);
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_receiver ON friendships(receiver_id);
CREATE INDEX idx_profiles_username ON profiles(username);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_media_updated_at BEFORE UPDATE ON user_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER friendships_updated_at BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE filter_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_external_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_genres ENABLE ROW LEVEL SECURITY;

-- Media: public read
CREATE POLICY media_select ON media FOR SELECT USING (true);
CREATE POLICY media_external_ids_select ON media_external_ids FOR SELECT USING (true);
CREATE POLICY media_genres_select ON media_genres FOR SELECT USING (true);
CREATE POLICY genres_select ON genres FOR SELECT USING (true);

-- Profiles
CREATE POLICY profiles_select_own ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_select_public ON profiles FOR SELECT
  USING (profile_visibility = 'public');
CREATE POLICY profiles_update_own ON profiles FOR UPDATE USING (auth.uid() = id);

-- User media: own only
CREATE POLICY user_media_all ON user_media FOR ALL USING (auth.uid() = user_id);

-- Reviews: own + visibility
CREATE POLICY reviews_own ON reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY reviews_select_public ON reviews FOR SELECT
  USING (visibility = 'public');
CREATE POLICY reviews_select_friends ON reviews FOR SELECT
  USING (
    visibility = 'friends'
    AND EXISTS (
      SELECT 1 FROM friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.requester_id = auth.uid() AND f.receiver_id = reviews.user_id)
          OR (f.receiver_id = auth.uid() AND f.requester_id = reviews.user_id)
        )
    )
  );

-- Friendships
CREATE POLICY friendships_select ON friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);
CREATE POLICY friendships_insert ON friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY friendships_update ON friendships FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Filter presets
CREATE POLICY filter_presets_all ON filter_presets FOR ALL USING (auth.uid() = user_id);

-- Recommendations
CREATE POLICY recommendations_select ON recommendations FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY recommendations_insert ON recommendations FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Deck sessions
CREATE POLICY deck_sessions_all ON deck_sessions FOR ALL USING (auth.uid() = user_id);

-- Seed TMDB genres
INSERT INTO genres (id, name) VALUES
  (28, 'Action'), (12, 'Adventure'), (16, 'Animation'), (35, 'Comedy'),
  (80, 'Crime'), (99, 'Documentary'), (18, 'Drama'), (10751, 'Family'),
  (14, 'Fantasy'), (36, 'History'), (27, 'Horror'), (10402, 'Music'),
  (9648, 'Mystery'), (10749, 'Romance'), (878, 'Science Fiction'),
  (10770, 'TV Movie'), (53, 'Thriller'), (10752, 'War'), (37, 'Western')
ON CONFLICT (id) DO NOTHING;
