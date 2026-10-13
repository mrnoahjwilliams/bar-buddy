alter table cocktail
    add column styles text[] not null default '{}',
    add column tags text[] not null default '{}',
    add column aliases text[] not null default '{}',
    add column alcohol_free boolean,
    add constraint cocktail_styles_valid check (styles <@ array['old-fashioned','martini','manhattan','negroni','sour','daisy','collins','fizz','highball','spritz','julep','smash','swizzle','cobbler','flip','punch','duo-and-trio','tiki']::text[] and array_position(styles, null) is null),
    add constraint cocktail_tags_valid check (tags <@ array['refreshing','creamy','coffee','sparkling','spring','summer','autumn','winter','brunch','aperitif','after-dinner','celebration']::text[] and array_position(tags, null) is null),
    add constraint cocktail_aliases_valid check (array_position(aliases, null) is null);

create function catalog_alias_matches(aliases text[], search text) returns boolean
language sql immutable strict parallel safe
return exists (select 1 from unnest(aliases) alias where position(search in catalog_search_key(alias)) > 0);

create function catalog_metadata_matches(metadata text[], selection text) returns boolean
language sql immutable parallel safe
return selection is null or selection = any(metadata);

revoke all privileges on function catalog_alias_matches(text[], text), catalog_metadata_matches(text[], text) from public;
do $search_access$
declare data_api_role text;
begin
    foreach data_api_role in array array['anon', 'authenticated', 'service_role'] loop
        if exists (select from pg_roles where rolname = data_api_role) then
            execute format('revoke all privileges on function catalog_alias_matches(text[], text), catalog_metadata_matches(text[], text) from %I', data_api_role);
        end if;
    end loop;
end
$search_access$;
