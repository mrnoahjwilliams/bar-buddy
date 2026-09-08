import { useContext, type ComponentProps } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { DetailFocusContext } from './detail-focus-context';

export function DetailLink({
  kind,
  id,
  children,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, 'to'> & {
  kind: 'ingredient' | 'cocktail';
  id: string;
}) {
  const location = useLocation();
  const remember = useContext(DetailFocusContext);
  const params = new URLSearchParams(location.search);
  const depth = params.getAll('detail').length;
  params.append('detail', `${kind}:${id}`);
  return (
    <Link
      {...props}
      to={`${location.pathname}?${params}${location.hash}`}
      state={{ ...location.state, detailNavigation: true }}
      onClick={(event) => {
        if (
          !event.ctrlKey &&
          !event.metaKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.button === 0
        )
          remember(depth, event.currentTarget);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
