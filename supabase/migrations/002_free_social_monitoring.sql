alter table public.monitored_links
 add column check_method text not null default 'auto' check(check_method in ('auto','browser')),
 add column check_token uuid,
 add column check_started_at timestamptz;

create function public.claim_link_check(p_link_id uuid,p_user_id uuid) returns uuid
language plpgsql security invoker set search_path=public as $$
declare reservation uuid:=gen_random_uuid();
begin
 update monitored_links set check_token=reservation,check_started_at=now()
 where id=p_link_id and user_id=p_user_id and status='active'
 and (check_token is null or check_started_at<now()-interval '2 minutes');
 if not found then return null; end if;
 return reservation;
end; $$;

create function public.finish_link_check(p_link_id uuid,p_token uuid,p_http_status integer,p_content text,p_analysis jsonb,p_health text) returns boolean
language plpgsql security invoker set search_path=public as $$
begin
 perform 1 from monitored_links where id=p_link_id and check_token=p_token for update;
 if not found then return false; end if;
 insert into link_logs(link_id,http_status,extracted_content,ai_analysis_result) values(p_link_id,p_http_status,p_content,p_analysis);
 update monitored_links set health=p_health,last_checked_at=now(),check_token=null,check_started_at=null where id=p_link_id;
 return true;
end; $$;
revoke all on function public.claim_link_check(uuid,uuid) from public,anon,authenticated;
revoke all on function public.finish_link_check(uuid,uuid,integer,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.claim_link_check(uuid,uuid) to service_role;
grant execute on function public.finish_link_check(uuid,uuid,integer,text,jsonb,text) to service_role;
