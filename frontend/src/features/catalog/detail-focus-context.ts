import { createContext } from 'react';

export const DetailFocusContext = createContext<
  (depth: number, element: HTMLElement) => void
>(() => {});
