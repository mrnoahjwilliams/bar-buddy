create table inventory_item (
    id uuid primary key,
    owner_user_id uuid not null references app_user(id),
    ingredient_id uuid not null references ingredient(id),
    bottle_label varchar(200) check (bottle_label is null or length(trim(bottle_label)) > 0),
    status varchar(4) not null check (status in ('Have', 'Out'))
);
create index inventory_owner_ingredient_status_idx on inventory_item(owner_user_id, ingredient_id, status);
create index inventory_ingredient_idx on inventory_item(ingredient_id);
revoke all privileges on table inventory_item from public;
do $inventory_access$
declare data_api_role text;
begin
    foreach data_api_role in array array['anon', 'authenticated', 'service_role'] loop
        if exists (select from pg_roles where rolname = data_api_role) then
            execute format('revoke all privileges on table inventory_item from %I', data_api_role);
        end if;
    end loop;
end
$inventory_access$;
