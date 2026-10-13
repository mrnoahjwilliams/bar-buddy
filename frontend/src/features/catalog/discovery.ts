import type {
  CocktailSummary,
  ListCocktailsParams,
} from '@/api/generated/models';

export const styles = [
  'old-fashioned',
  'martini',
  'manhattan',
  'negroni',
  'sour',
  'daisy',
  'collins',
  'fizz',
  'highball',
  'spritz',
  'julep',
  'smash',
  'swizzle',
  'cobbler',
  'flip',
  'punch',
  'duo-and-trio',
  'tiki',
];
export const tagGroups = {
  General: ['refreshing', 'creamy', 'coffee', 'sparkling'],
  Seasonal: ['spring', 'summer', 'autumn', 'winter'],
  Occasion: ['brunch', 'aperitif', 'after-dinner', 'celebration'],
};

export function displayMetadata(value: string) {
  const names: Record<string, string> = {
    alcohol_free: 'Alcohol-free',
    alcoholic: 'Contains alcohol',
    ingredient_count: 'Fewest ingredients',
    all: 'All drinks',
  };
  return (
    names[value] ??
    value
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .replace(/^./, (c) => c.toUpperCase())
  );
}

export function discoveryReady(
  cocktail: CocktailSummary,
  filters: ListCocktailsParams,
) {
  const needsDiscovery =
    filters.style ||
    filters.tag ||
    (filters.alcohol && filters.alcohol !== 'all') ||
    (filters.sort && filters.sort !== 'availability');
  return !needsDiscovery || cocktail.discoveryVersion === 1;
}
