
-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_seed text not null default gen_random_uuid()::text,
  context_summary text default '',
  last_active timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- AI MESSAGES (companion)
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index ai_messages_user_idx on public.ai_messages(user_id, created_at);
alter table public.ai_messages enable row level security;
create policy "ai_select_own" on public.ai_messages for select to authenticated using (auth.uid() = user_id);
create policy "ai_insert_own" on public.ai_messages for insert to authenticated with check (auth.uid() = user_id);
create policy "ai_delete_own" on public.ai_messages for delete to authenticated using (auth.uid() = user_id);

-- CONVERSATIONS
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  intro text default '',
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);
alter table public.conversations enable row level security;
create policy "conv_select_participants" on public.conversations
  for select to authenticated using (auth.uid() = user_a or auth.uid() = user_b);
create policy "conv_insert_participant" on public.conversations
  for insert to authenticated with check (auth.uid() = user_a or auth.uid() = user_b);

-- MESSAGES
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);
create index messages_conv_idx on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;

create policy "messages_select_participant" on public.messages
  for select to authenticated using (
    exists (select 1 from public.conversations c
            where c.id = conversation_id
              and (c.user_a = auth.uid() or c.user_b = auth.uid()))
  );
create policy "messages_insert_participant" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid() and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

-- bump conversation last_message_at
create or replace function public.bump_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;
  return new;
end $$;

create trigger messages_bump_conv after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- MATCH SKIPS
create table public.match_skips (
  user_id uuid not null references auth.users(id) on delete cascade,
  skipped_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, skipped_user_id)
);
alter table public.match_skips enable row level security;
create policy "skips_select_own" on public.match_skips for select to authenticated using (auth.uid() = user_id);
create policy "skips_insert_own" on public.match_skips for insert to authenticated with check (auth.uid() = user_id);

-- handle_new_user trigger -> auto profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  adjectives text[] := array['Velvet','Quiet','Lunar','Hollow','Midnight','Silent','Amber','Dusk','Ember','Soft','Drift','Glass','Pale','Slow','Faint','Inner','Twilight','Wandering','Distant','Cobalt'];
  nouns text[] := array['Signal','Orbit','Echo','Bloom','Passenger','Static','Tide','Lantern','Halo','Whisper','Current','Mirror','Cinder','Field','Dream','Stranger','Hour','Letter','Frame','Comet'];
  new_username text;
  attempt int := 0;
begin
  loop
    new_username := adjectives[1 + floor(random() * array_length(adjectives,1))::int]
                 || nouns[1 + floor(random() * array_length(nouns,1))::int];
    exit when not exists (select 1 from public.profiles where username = new_username) or attempt > 8;
    attempt := attempt + 1;
  end loop;
  if exists (select 1 from public.profiles where username = new_username) then
    new_username := new_username || floor(random()*9999)::int::text;
  end if;

  insert into public.profiles (id, username, avatar_seed)
  values (new.id, new_username, gen_random_uuid()::text);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.profiles;
