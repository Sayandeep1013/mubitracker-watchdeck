-- Close a defense-in-depth RLS gap: friends-visibility profiles were only
-- readable by their owner or when profile_visibility='public'. The app's
-- own friend-profile lookups always use the service-role client (RLS
-- bypassed), so this was never exploitable — but any direct PostgREST
-- caller using the anon key would incorrectly be denied for accepted
-- friends viewing a 'friends'-visibility profile.

create policy profiles_select_friends on profiles
  for select
  using (
    profile_visibility = 'friends'
    and exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.receiver_id = profiles.id)
          or (f.receiver_id = auth.uid() and f.requester_id = profiles.id))
    )
  );
