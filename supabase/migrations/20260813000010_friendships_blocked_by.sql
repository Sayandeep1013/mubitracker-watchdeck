-- Spec 40 §4: unblock needs to know who did the blocking — the row keeps
-- its original requester/receiver ordering regardless of who blocked whom,
-- so without this the API can't enforce "only the blocker may unblock."
alter table friendships
  add column if not exists blocked_by uuid references profiles(id);
