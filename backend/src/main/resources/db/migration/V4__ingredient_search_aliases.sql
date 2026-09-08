alter table ingredient add column aliases text[] not null default '{}';

create function catalog_search_key(value text) returns text
language sql immutable strict parallel safe
return regexp_replace(normalize(lower(value), NFD), U&'[\0300-\036f]', '', 'g');

revoke all privileges on function catalog_search_key(text) from public;
do $search_access$
declare data_api_role text;
begin
    foreach data_api_role in array array['anon', 'authenticated', 'service_role'] loop
        if exists (select from pg_roles where rolname = data_api_role) then
            execute format('revoke all privileges on function catalog_search_key(text) from %I', data_api_role);
        end if;
    end loop;
end
$search_access$;
