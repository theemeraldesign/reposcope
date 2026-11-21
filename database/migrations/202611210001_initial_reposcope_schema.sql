create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login text not null,
  account_type text not null check (account_type in ('User', 'Organization')),
  created_at timestamptz not null default now()
);

create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  github_repo_id bigint not null,
  installation_id bigint,
  full_name text not null,
  owner_login text not null,
  name text not null,
  description text,
  visibility text not null check (visibility in ('public', 'private')),
  default_branch text,
  is_archived boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, github_repo_id)
);

create table public.repository_snapshots (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  captured_at timestamptz not null default now(),
  stars_count integer not null default 0 check (stars_count >= 0),
  forks_count integer not null default 0 check (forks_count >= 0),
  open_issues_count integer not null default 0 check (open_issues_count >= 0),
  subscribers_count integer not null default 0 check (subscribers_count >= 0),
  commit_activity jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  score numeric(5,2) check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  findings jsonb not null default '[]'::jsonb,
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  analysis_run_id uuid references public.analysis_runs(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  share_token_hash text unique,
  report_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((visibility = 'private') or share_token_hash is not null)
);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event_type text not null,
  installation_id bigint,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);

create index repositories_owner_updated_idx on public.repositories(owner_id, updated_at desc);
create index repository_snapshots_repo_captured_idx on public.repository_snapshots(repository_id, captured_at desc);
create index analysis_runs_repo_created_idx on public.analysis_runs(repository_id, created_at desc);
create index reports_owner_created_idx on public.reports(owner_id, created_at desc);
create index webhook_deliveries_received_idx on public.webhook_deliveries(received_at desc);

alter table public.profiles enable row level security;
alter table public.github_installations enable row level security;
alter table public.repositories enable row level security;
alter table public.repository_snapshots enable row level security;
alter table public.analysis_runs enable row level security;
alter table public.reports enable row level security;
alter table public.webhook_deliveries enable row level security;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.github_installations to authenticated;
grant select, insert, update, delete on public.repositories to authenticated;
grant select on public.repository_snapshots to authenticated;
grant select on public.analysis_runs to authenticated;
grant select, insert, update, delete on public.reports to authenticated;

create policy "Users manage their own profile" on public.profiles for all to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "Users manage their GitHub installations" on public.github_installations for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their repositories" on public.repositories for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Users read snapshots for their repositories" on public.repository_snapshots for select to authenticated
using (exists (select 1 from public.repositories r where r.id = repository_id and r.owner_id = (select auth.uid())));
create policy "Users read analysis for their repositories" on public.analysis_runs for select to authenticated
using (exists (select 1 from public.repositories r where r.id = repository_id and r.owner_id = (select auth.uid())));
create policy "Users manage their reports" on public.reports for all to authenticated
using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);