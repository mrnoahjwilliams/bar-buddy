create table ingredient (
    id uuid primary key,
    catalog_id text not null unique check (catalog_id ~ '^ingredient:[a-z0-9]+(-[a-z0-9]+)*$'),
    name text not null check (name is null or length(trim(name)) > 0),
    category text not null check (category in ('spirit', 'liqueur', 'fortified_wine', 'bitters', 'syrup', 'juice', 'mixer', 'fruit', 'herb', 'garnish', 'other'))
);

create table cocktail (
    id uuid primary key,
    catalog_id text not null unique check (catalog_id ~ '^cocktail:[a-z0-9]+(-[a-z0-9]+)*$'),
    slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    name text not null check (name is null or length(trim(name)) > 0),
    primary_spirit_id uuid references ingredient(id)
);

create table recipe (
    id uuid primary key,
    catalog_id text not null unique check (catalog_id ~ '^recipe:[a-z0-9]+(-[a-z0-9]+)*:[a-z0-9]+(-[a-z0-9]+)*$'),
    cocktail_id uuid not null references cocktail(id),
    name text not null check (name is null or length(trim(name)) > 0),
    instructions text not null check (instructions is null or length(trim(instructions)) > 0),
    glassware text not null check (glassware is null or length(trim(glassware)) > 0),
    garnish text check (garnish is null or length(trim(garnish)) > 0)
);

create table recipe_ingredient (
    id uuid primary key,
    recipe_id uuid not null references recipe(id),
    ingredient_id uuid not null references ingredient(id),
    position integer not null check (position > 0),
    recipe_display_name text not null check (recipe_display_name is null or length(trim(recipe_display_name)) > 0),
    requirement text not null check (requirement in ('required', 'optional')),
    preparation text check (preparation is null or length(trim(preparation)) > 0),
    us_quantity numeric check (us_quantity > 0 and us_quantity not in ('NaN'::numeric, 'Infinity'::numeric)),
    us_maximum_quantity numeric check (us_maximum_quantity not in ('NaN'::numeric, 'Infinity'::numeric)),
    us_unit text not null check (us_unit in ('barspoon', 'cube', 'dash', 'drop', 'leaf', 'milliliter', 'ounce', 'piece', 'pinch', 'shot', 'slice', 'splash', 'sprig', 'tablespoon', 'teaspoon', 'to-taste', 'top-up', 'wheel')),
    us_modifier text check (us_modifier in ('scant', 'heavy')),
    check (us_quantity is not null or us_unit in ('dash', 'drop', 'splash', 'to-taste', 'top-up')),
    check (us_maximum_quantity is null or (us_quantity is not null and us_maximum_quantity >= us_quantity)),
    check (us_modifier is null or us_quantity is not null),
    metric_quantity numeric check (metric_quantity > 0 and metric_quantity not in ('NaN'::numeric, 'Infinity'::numeric)),
    metric_maximum_quantity numeric check (metric_maximum_quantity not in ('NaN'::numeric, 'Infinity'::numeric)),
    metric_unit text not null check (metric_unit in ('barspoon', 'cube', 'dash', 'drop', 'leaf', 'milliliter', 'ounce', 'piece', 'pinch', 'shot', 'slice', 'splash', 'sprig', 'tablespoon', 'teaspoon', 'to-taste', 'top-up', 'wheel')),
    metric_modifier text check (metric_modifier in ('scant', 'heavy')),
    check (metric_quantity is not null or metric_unit in ('dash', 'drop', 'splash', 'to-taste', 'top-up')),
    check (metric_maximum_quantity is null or (metric_quantity is not null and metric_maximum_quantity >= metric_quantity)),
    check (metric_modifier is null or metric_quantity is not null),
    check (us_modifier is null or us_unit = 'ounce'),
    check (metric_modifier is null),
    check (us_unit = metric_unit or (us_unit in ('ounce', 'barspoon') and metric_unit = 'milliliter')),
    check (us_unit <> metric_unit or
        (us_quantity is not distinct from metric_quantity and
         us_maximum_quantity is not distinct from metric_maximum_quantity)),
    unique (recipe_id, position)
);

create index cocktail_primary_spirit_idx on cocktail(primary_spirit_id);

create index recipe_cocktail_idx on recipe(cocktail_id);

create index recipe_ingredient_ingredient_idx on recipe_ingredient(ingredient_id);

revoke all privileges on table ingredient, cocktail, recipe, recipe_ingredient from public;

do $catalog_access$
declare
    data_api_role text;
begin
    foreach data_api_role in array array['anon', 'authenticated', 'service_role']
    loop
        if exists (select from pg_roles where rolname = data_api_role) then
            execute format(
                'revoke all privileges on table ingredient, cocktail, recipe, recipe_ingredient from %I',
                data_api_role
            );
        end if;
    end loop;
end
$catalog_access$;
