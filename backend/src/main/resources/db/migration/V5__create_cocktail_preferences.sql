create table user_cocktail_state (
    id uuid primary key,
    owner_user_id uuid not null references app_user(id),
    cocktail_id uuid not null references cocktail(id),
    favorite boolean not null,
    constraint user_cocktail_state_owner_cocktail_unique unique (owner_user_id, cocktail_id)
);

create index user_cocktail_state_owner_favorite_idx
    on user_cocktail_state(owner_user_id, favorite, cocktail_id);
create index user_cocktail_state_cocktail_idx on user_cocktail_state(cocktail_id);

revoke all privileges on table user_cocktail_state from public;
do $cocktail_preference_access$
declare data_api_role text;
begin
    foreach data_api_role in array array['anon', 'authenticated', 'service_role'] loop
        if exists (select from pg_roles where rolname = data_api_role) then
            execute format(
                'revoke all privileges on table user_cocktail_state from %I',
                data_api_role
            );
        end if;
    end loop;
end
$cocktail_preference_access$;
