-- Spec 40 §6: UNIQUE(requester_id, receiver_id) only protects one direction,
-- so after A→B is accepted, B could still successfully insert a second row
-- requesting A. Add a direction-agnostic unique index, after a defensive
-- dedup pass (no-op today — verified 0 duplicate pairs exist — but this
-- keeps the migration safe to replay against a future dataset that does).

with ranked as (
  select id,
         row_number() over (
           partition by least(requester_id, receiver_id), greatest(requester_id, receiver_id)
           order by (status = 'accepted') desc, (status = 'pending') desc, created_at asc
         ) as rn
  from friendships
)
delete from friendships
where id in (select id from ranked where rn > 1);

create unique index if not exists friendships_pair_uniq
  on friendships (least(requester_id, receiver_id), greatest(requester_id, receiver_id));
