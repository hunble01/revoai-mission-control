-- RevoAI Mission Control MVP schema (updated with campaigns/scheduler/dry-run)
create extension if not exists "pgcrypto";

do $$ begin create type role_type as enum ('admin','operator','closer','viewer'); exception when duplicate_object then null; end $$;
do $$ begin create type agent_status as enum ('idle','running','paused','blocked'); exception when duplicate_object then null; end $$;
do $$ begin create type task_column as enum ('backlog','doing','needs_approval','done'); exception when duplicate_object then null; end $$;
do $$ begin create type priority_level as enum ('low','med','high'); exception when duplicate_object then null; end $$;
do $$ begin create type actor_type as enum ('user','agent','system'); exception when duplicate_object then null; end $$;
do $$ begin create type lead_score as enum ('A','B','C'); exception when duplicate_object then null; end $$;
do $$ begin create type lead_status as enum ('new','enriched','drafted','approved','contacted','replied','booked','lost'); exception when duplicate_object then null; end $$;
do $$ begin create type draft_status as enum ('draft','needs_approval','approved','rejected'); exception when duplicate_object then null; end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role role_type not null default 'admin',
  password_hash text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  niche text not null,
  geography text not null,
  min_score lead_score not null default 'B',
  outreach_templates jsonb not null default '{}'::jsonb,
  content_themes jsonb not null default '[]'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  business_name text not null,
  niche text,
  region text,
  website text,
  contact_name text,
  contact_role text,
  email text,
  phone text,
  source text,
  lead_score lead_score,
  score_override lead_score,
  score_override_reason text,
  status lead_status not null default 'new',
  last_action_at timestamptz,
  next_step text,
  notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,
  channel text not null,
  draft_type text not null,
  status draft_status not null default 'draft',
  current_version int not null default 1,
  approver_id uuid references users(id) on delete set null,
  scheduled_send_at timestamptz,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  version_number int not null,
  content text not null,
  change_note text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (draft_id, version_number)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  title text not null,
  description text,
  column_name task_column not null default 'backlog',
  priority priority_level not null default 'med',
  owner_type text not null default 'agent',
  owner_id uuid,
  linked_lead_id uuid references leads(id) on delete set null,
  linked_draft_id uuid references drafts(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  done_at timestamptz
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  status agent_status not null default 'idle',
  current_task_id uuid references tasks(id) on delete set null,
  last_update_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists task_events (
  id bigserial primary key,
  task_id uuid references tasks(id) on delete set null,
  campaign_id uuid references campaigns(id) on delete set null,
  agent_id uuid references agents(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references drafts(id) on delete cascade,
  action text not null,
  notes text,
  editor_content text,
  decided_by uuid references users(id) on delete set null,
  decided_at timestamptz not null default now()
);

create table if not exists scheduler_jobs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  name text not null,
  cron_expr text not null,
  timezone text not null default 'America/Toronto',
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references scheduler_jobs(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists audit_log (
  id bigserial primary key,
  actor_type actor_type not null,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text not null,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into settings (key, value) values
('global_pause', '{"paused": false}'::jsonb),
('dry_run_mode', '{"enabled": true}'::jsonb),
('outbound_channels', '{"email": false, "facebook": false, "instagram": false, "linkedin": false}'::jsonb)
on conflict (key) do nothing;
