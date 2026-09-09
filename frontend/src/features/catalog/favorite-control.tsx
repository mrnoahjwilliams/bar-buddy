import { Star } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUpdateCocktailPreference } from '@/api/generated/bar-buddy';
import { Button } from '@/components/ui/button';

function useRefreshCocktails() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: ({ queryKey }) => {
        const path = queryKey[0];
        return (
          typeof path === 'string' &&
          ['/api/v1/home', '/api/v1/cocktails', '/api/v1/ingredients'].some(
            (prefix) => path.startsWith(prefix),
          )
        );
      },
    });
}

export function FavoriteControl({
  cocktailId,
  cocktailName,
  favorite,
  compact = false,
}: {
  cocktailId: string;
  cocktailName?: string;
  favorite: boolean;
  compact?: boolean;
}) {
  const refresh = useRefreshCocktails();
  const update = useUpdateCocktailPreference({
    mutation: { onSuccess: refresh },
  });
  const action = favorite ? 'Remove from favorites' : 'Add to favorites';
  return (
    <div className={compact ? 'relative' : 'space-y-2'}>
      <Button
        type="button"
        variant={favorite ? 'secondary' : 'outline'}
        size={compact ? 'icon-lg' : 'default'}
        disabled={update.isPending}
        aria-label={compact ? `${action}: ${cocktailName}` : undefined}
        aria-pressed={favorite}
        title={compact ? action : undefined}
        onClick={() =>
          update.mutate({
            id: cocktailId,
            data: { favorite: !favorite },
          })
        }
      >
        <Star fill={favorite ? 'currentColor' : 'none'} aria-hidden="true" />
        {!compact && (favorite ? 'Favorited' : 'Add to favorites')}
      </Button>
      {update.isError && (
        <p
          role="alert"
          className={
            compact
              ? 'absolute right-0 top-12 z-20 w-64 rounded-lg border border-border bg-card p-3 text-sm text-destructive shadow-lg'
              : 'text-sm text-destructive'
          }
        >
          Your favorite could not be saved. Please try again.
        </p>
      )}
    </div>
  );
}
