import {
  lazy,
  Suspense,
  useLayoutEffect,
  useRef,
  type PropsWithChildren,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog } from 'radix-ui';
import { X } from 'lucide-react';
import { DetailFocusContext } from './detail-focus-context';

const IngredientDetail = lazy(() =>
  import('./catalog-pages').then((m) => ({ default: m.IngredientDetailPage })),
);
const CocktailDetail = lazy(() =>
  import('./catalog-pages').then((m) => ({ default: m.CocktailDetailPage })),
);

export function DetailOverlays({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const openers = useRef(new Map<number, HTMLElement>());
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousDepth = useRef(0);
  const params = new URLSearchParams(location.search);
  const details = params.getAll('detail');
  const depth = details.length;
  useLayoutEffect(() => {
    if (depth > 0 && previousDepth.current !== depth) {
      const opener = openers.current.get(depth);
      if (previousDepth.current > depth && opener?.isConnected)
        opener.focus({ preventScroll: true });
      else closeButton.current?.focus({ preventScroll: true });
    }
    previousDepth.current = depth;
  }, [depth]);
  function close() {
    if (location.state?.detailNavigation) {
      void navigate(-1);
      return;
    }
    params.delete('detail');
    details.slice(0, -1).forEach((detail) => params.append('detail', detail));
    void navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
        hash: location.hash,
      },
      { replace: true },
    );
  }
  const kind = details.at(-1)?.split(':')[0];
  return (
    <DetailFocusContext.Provider
      value={(index, element) => openers.current.set(index, element)}
    >
      {children}
      <Dialog.Root
        open={depth > 0}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]" />
          <Dialog.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const opener = openers.current.get(0);
              const target = opener?.isConnected
                ? opener
                : document.getElementById('main-content');
              target?.focus({ preventScroll: true });
            }}
            className="fixed left-1/2 top-1/2 z-50 flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:w-[calc(100%-4rem)]"
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-5 py-3 sm:px-8">
              <Dialog.Title className="font-semibold">
                {kind === 'ingredient'
                  ? 'Ingredient details'
                  : kind === 'cocktail'
                    ? 'Cocktail details'
                    : 'Details'}
              </Dialog.Title>
              <button
                ref={closeButton}
                onClick={close}
                className="flex min-h-11 items-center gap-2 rounded-lg px-3 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
                aria-label="Close details"
              >
                <X aria-hidden="true" className="size-4" />
                Close
              </button>
            </div>
            {details.map((detail, index) => {
              const separator = detail.indexOf(':');
              const detailKind = detail.slice(0, separator);
              const id = detail.slice(separator + 1);
              const valid =
                separator > 0 &&
                id.length > 0 &&
                ['ingredient', 'cocktail'].includes(detailKind);
              return (
                <div
                  key={`${index}:${detail}`}
                  hidden={index !== depth - 1}
                  className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-8"
                >
                  <Suspense fallback={<p role="status">Loading details…</p>}>
                    {!valid ? (
                      <p role="alert">
                        This detail link is invalid. Close it and choose a
                        catalog item.
                      </p>
                    ) : detailKind === 'ingredient' ? (
                      <IngredientDetail detailId={id} overlay />
                    ) : (
                      <CocktailDetail detailId={id} overlay />
                    )}
                  </Suspense>
                </div>
              );
            })}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DetailFocusContext.Provider>
  );
}
