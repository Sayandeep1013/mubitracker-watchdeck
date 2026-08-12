-- Watch later status + notifications for friends

ALTER TABLE user_media DROP CONSTRAINT IF EXISTS user_media_status_check;
ALTER TABLE user_media
  ADD CONSTRAINT user_media_status_check
  CHECK (status IN ('watched', 'unwatched', 'watch_later'));

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('friend_request', 'friend_accepted')),
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  friendship_id UUID REFERENCES friendships(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Prefix search helper index (optional; username already indexed)
CREATE INDEX IF NOT EXISTS idx_profiles_username_prefix ON profiles (username text_pattern_ops);
