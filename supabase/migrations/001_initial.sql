create table public.profiles (id uuid primary key default gen_random_uuid(), email text unique not null, created_at timestamptz not null default now());
insert into public.profiles(id,email) values ('00000000-0000-4000-8000-000000000001','admin@controlmkt.local');
create table public.monitored_links (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
 url text not null check (url ~ '^https?://'), name text not null check (char_length(name) between 1 and 120),
 status text not null default 'active' check (status in ('active','paused','error')),
 health text not null default 'pending' check (health in ('pending','healthy','alert','error')),
 check_frequency text not null default 'manual' check (check_frequency in ('manual','hourly','daily')),
 last_checked_at timestamptz, created_at timestamptz not null default now(), unique(user_id,url)
);
create table public.link_logs (
 id uuid primary key default gen_random_uuid(), link_id uuid not null references public.monitored_links(id) on delete cascade,
 http_status integer not null, extracted_content text, ai_analysis_result jsonb not null default '{}', checked_at timestamptz not null default now()
);
create index link_logs_history on public.link_logs(link_id,checked_at desc);
alter table public.profiles enable row level security;
alter table public.monitored_links enable row level security;
alter table public.link_logs enable row level security;
-- Acceso exclusivamente mediante el servidor autenticado y service_role.
create function public.record_link_check(p_link_id uuid,p_http_status integer,p_content text,p_analysis jsonb,p_health text) returns void language plpgsql security invoker set search_path = public as $$
begin
 insert into link_logs(link_id,http_status,extracted_content,ai_analysis_result) values(p_link_id,p_http_status,p_content,p_analysis);
 update monitored_links set health=p_health,last_checked_at=now() where id=p_link_id;
end; $$;
revoke all on function public.record_link_check(uuid,integer,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.record_link_check(uuid,integer,text,jsonb,text) to service_role;
