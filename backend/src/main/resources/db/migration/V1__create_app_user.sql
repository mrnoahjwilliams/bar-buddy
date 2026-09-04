create table app_user (
    id uuid primary key,
    auth_subject varchar(255) not null,
    created_at timestamptz not null default current_timestamp,
    constraint app_user_auth_subject_unique unique (auth_subject),
    constraint app_user_auth_subject_not_blank check (length(trim(auth_subject)) > 0)
);

revoke all privileges on table app_user from public;

alter default privileges in schema public revoke all privileges on tables from public;
alter default privileges in schema public revoke all privileges on sequences from public;
-- Remove both a provider-supplied schema default and PostgreSQL's global
-- function EXECUTE default; neither revoke substitutes for the other.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges revoke execute on functions from public;

do $data_api_access$
declare
    data_api_role text;
begin
    foreach data_api_role in array array['anon', 'authenticated', 'service_role']
    loop
        if exists (select from pg_roles where rolname = data_api_role) then
            execute format('revoke all privileges on table public.app_user from %I', data_api_role);
            execute format(
                'alter default privileges in schema public revoke all privileges on tables from %I',
                data_api_role
            );
            execute format(
                'alter default privileges in schema public revoke all privileges on sequences from %I',
                data_api_role
            );
            execute format(
                'alter default privileges in schema public revoke execute on functions from %I',
                data_api_role
            );
        end if;
    end loop;
end
$data_api_access$;
