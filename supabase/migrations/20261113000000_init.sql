-- Bamanbirr initial schema.
-- Stored: only telebirr / CBE message text (never the original PDF or chat.db),
-- versioned analysis runs, and the user's label rules. Every table is
-- protected by row-level security: a user can only reach their own rows.

-- ------------------------------------------------------------------ uploads
create table public.uploads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  format      text not null check (format in ('pdf', 'chatdb', 'xml', 'android_inbox', 'ios_shortcut')),
  sources     text[] not null,
  messages_added integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------- messages
-- One row per bank SMS. The fingerprint (hash of source + time + text,
-- computed on the device) makes uploads idempotent across devices.
create table public.messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  upload_id   uuid references public.uploads (id) on delete set null,
  source      text not null check (source in ('telebirr', 'cbe')),
  sms_time    timestamp,
  body        text not null,
  fingerprint text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create index messages_user_source_time on public.messages (user_id, source, sms_time);

-- --------------------------------------------------------------------- runs
-- An analysis run is an immutable version. Re-running the same message set
-- with the same parser version reuses the existing run.
create table public.runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version          integer not null,
  parser_version   text not null,
  sources          text[] not null,
  message_set_hash text not null,
  message_count    integer not null,
  date_from        date,
  date_to          date,
  summary          jsonb not null default '{}'::jsonb,   -- totals for the runs list
  result           jsonb not null,                       -- AnalysisResult from @bamanbirr/parser
  created_at       timestamptz not null default now(),
  unique (user_id, version),
  unique (user_id, parser_version, message_set_hash)
);

create function public.next_run_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  select coalesce(max(version), 0) + 1 into new.version from public.runs where user_id = new.user_id;
  return new;
end $$;
create trigger runs_version before insert on public.runs
  for each row when (new.version is null) execute function public.next_run_version();

-- ------------------------------------------------------------------- labels
create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source      text not null check (source in ('telebirr', 'cbe')),
  match       jsonb not null,   -- { counterparty?, date? }
  "set"       jsonb not null,   -- { counterparty?, kind? }
  note        text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------- row-level security
alter table public.uploads  enable row level security;
alter table public.messages enable row level security;
alter table public.runs     enable row level security;
alter table public.labels   enable row level security;

create policy "own uploads"  on public.uploads  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own messages" on public.messages for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own runs"     on public.runs     for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own labels"   on public.labels   for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
