-- Case-insensitive unique usernames + normalize on profile create

UPDATE profiles SET username = lower(username) WHERE username <> lower(username);

DROP INDEX IF EXISTS idx_profiles_username;
CREATE UNIQUE INDEX idx_profiles_username_lower ON profiles (lower(username));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    lower(
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8)
      )
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;
