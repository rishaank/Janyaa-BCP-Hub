-- ============================================================================
-- Janyaa BCP Hub — database schema
-- Paste this whole file into the Supabase SQL Editor and click "Run".
-- Safe to re-run: it drops and recreates everything.
-- ============================================================================

-- ---- Clean slate (so you can re-run this file) ----------------------------
drop table if exists public.event_todos cascade;
drop table if exists public.event_signups cascade;
drop table if exists public.locations cascade;
drop table if exists public.events cascade;
drop table if exists public.profiles cascade;

-- ---- Profiles: one row per signed-in member -------------------------------
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text,
  email       text,
  role        text not null default 'member',  -- president | vp | pr | secretary | treasurer | member
  joined_date date not null default current_date,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- Events ---------------------------------------------------------------
create table public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        date not null,
  location    text,
  type        text not null default 'other',   -- evsfm | vasona | library | sunday_friends | st_andrews | restaurant_night | other
  raised      numeric not null default 0,
  hours       numeric not null default 0,       -- hours each attendee earns
  min_people  int not null default 0,
  max_people  int,
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---- Event signups: a member volunteering for an event --------------------
create table public.event_signups (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events on delete cascade,
  member_id  uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, member_id)
);

-- ---- Event to-dos: who brings what (tables, supplies, etc.) ---------------
create table public.event_todos (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events on delete cascade,
  item        text not null,
  assignee_id uuid references public.profiles on delete set null,  -- null = nobody has claimed it
  done        boolean not null default false,                      -- true = it's been brought
  created_at  timestamptz not null default now()
);

-- ---- Locations: saved fundraising spots -----------------------------------
create table public.locations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  address        text,
  latitude       numeric,
  longitude      numeric,
  status         text not null default 'prospect',  -- prospect | contacted | approved | declined | recurring_partner
  contact_person text,
  contact_email  text,
  description    text,
  saved_at       timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- MVP model from the project brief: any signed-in club member has full access.
-- Signups are the one exception — you can only add/remove your OWN signup.
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.events        enable row level security;
alter table public.event_signups enable row level security;
alter table public.event_todos   enable row level security;
alter table public.locations     enable row level security;

-- Profiles: everyone signed in can read the directory; you can edit only yourself.
create policy "profiles: read"        on public.profiles      for select to authenticated using (true);
create policy "profiles: update self" on public.profiles      for update to authenticated using (auth.uid() = id);

-- Events / todos / locations: full access for any signed-in member.
create policy "events: all"      on public.events        for all to authenticated using (true) with check (true);
create policy "todos: all"       on public.event_todos   for all to authenticated using (true) with check (true);
create policy "locations: all"   on public.locations     for all to authenticated using (true) with check (true);

-- Signups: read all, but only manage your own.
create policy "signups: read"        on public.event_signups for select to authenticated using (true);
create policy "signups: insert self" on public.event_signups for insert to authenticated with check (auth.uid() = member_id);
create policy "signups: delete self" on public.event_signups for delete to authenticated using (auth.uid() = member_id);

-- ============================================================================
-- Seed data — the club's real events so the app isn't empty on first load.
-- (Members appear here as people actually sign up; to-dos start unassigned.)
-- ============================================================================
insert into public.events (name, date, location, type, raised, hours, min_people, max_people, notes) values
  ('EVSFM Spring Fundraiser', '2026-03-22', 'Evergreen Village Square, San Jose', 'evsfm', 520, 4, 4, 8, 'Best turnout yet. Booth next to the produce stand worked well.'),
  ('EVSFM Fall Fundraiser',   '2025-11-16', 'Evergreen Village Square, San Jose', 'evsfm', 480, 4, 4, 8, 'Cold morning, slow start. Bring a second card reader next time.'),
  ('Vasona Park Lemonade Stand', '2025-07-12', 'Vasona Lake County Park, Los Gatos', 'vasona', 230, 3, 3, 6, 'Hot day = good lemonade sales. Restock cups earlier.'),
  ('Library STEM Session',    '2026-06-07', 'Evergreen Branch Library', 'library', 0, 3, 2, 5, 'Lab-in-a-Box: circuits kit.'),
  ('Sunday Friends Session',  '2026-06-14', 'Sunday Friends, San Jose', 'sunday_friends', 0, 3, 2, 6, 'Volcano experiment. Confirm headcount with site coordinator.'),
  ('St. Andrew''s STEM Session', '2026-06-21', 'St. Andrew''s, Saratoga', 'st_andrews', 0, 3, 2, 5, 'First session of the summer series.');

-- To-dos for the upcoming fundraisers/sessions (start unassigned).
insert into public.event_todos (event_id, item, done)
select id, t.item, false
from public.events e
cross join (values ('Folding tables'), ('Circuits kit'), ('Sign-up flyer'), ('Cash box + card reader')) as t(item)
where e.name = 'Library STEM Session';

insert into public.event_todos (event_id, item, done)
select id, t.item, false
from public.events e
cross join (values ('Lemonade supplies'), ('Folding tables'), ('Volcano materials')) as t(item)
where e.name = 'Sunday Friends Session';

-- A couple of saved locations to start the map off.
insert into public.locations (name, address, latitude, longitude, status, contact_person, description) values
  ('Evergreen Village Square', '4949 Aborn Rd, San Jose, CA', 37.3266, -121.7674, 'recurring_partner', 'Market Manager', 'Hosts the EVSFM fundraiser twice a year. Reliable.'),
  ('Vasona Lake County Park', '333 Blossom Hill Rd, Los Gatos, CA', 37.2358, -121.9623, 'approved', 'Parks Dept.', 'Needs a $25 vendor permit. Best on hot summer weekends.');
