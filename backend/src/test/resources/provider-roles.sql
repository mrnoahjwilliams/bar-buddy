create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

alter default privileges in schema public
    grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
    grant usage, select on sequences to anon, authenticated, service_role;
alter default privileges in schema public
    grant execute on functions to public, anon, authenticated, service_role;
