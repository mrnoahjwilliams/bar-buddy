import { useContext, useEffect, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getRandomCocktail } from '@/api/generated/bar-buddy';
import type { ListCocktailsParams } from '@/api/generated/models';
import { ApiError } from '@/api/http';
import { Button } from '@/components/ui/button';
import { DetailFocusContext } from '@/features/catalog/detail-focus-context';

export function RandomCocktail({ filters }: { filters: ListCocktailsParams }) {
  const location = useLocation();
  const navigate = useNavigate();
  const remember = useContext(DetailFocusContext);
  const request = useRef<AbortController | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => () => request.current?.abort(), []);

  async function pick() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setMessage(undefined);
    setFailed(false);
    try {
      const cocktail = await getRandomCocktail(filters, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!cocktail.id) throw new Error('Missing cocktail');
      const params = new URLSearchParams(location.search);
      if (button.current)
        remember(params.getAll('detail').length, button.current);
      params.append('detail', `cocktail:${cocktail.id}`);
      void navigate(`${location.pathname}?${params}${location.hash}`, {
        state: { ...location.state, detailNavigation: true },
      });
    } catch (error) {
      if (controller.signal.aborted) return;
      const empty = error instanceof ApiError && error.status === 404;
      setFailed(!empty);
      setMessage(
        empty
          ? 'No matching cocktails. Change or reset your filters and try again.'
          : 'A cocktail couldn’t be picked. Please try again.',
      );
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          ref={button}
          type="button"
          className="min-h-11"
          disabled={pending}
          onClick={() => void pick()}
        >
          <Shuffle aria-hidden="true" />
          {pending ? 'Picking a cocktail…' : 'Random cocktail'}
        </Button>
        <p className="text-sm text-muted-foreground">
          Picks from your applied filters.
        </p>
      </div>
      {message && <p role={failed ? 'alert' : 'status'}>{message}</p>}
    </div>
  );
}
