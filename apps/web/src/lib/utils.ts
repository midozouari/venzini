import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type scale (text-title, text-section, …) must not be mistaken for text colors when classes
// are merged, or a color such as text-panel would be dropped.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: { 'font-size': [{ text: ['title', 'section', 'body', 'caption', 'kpi'] }] },
  },
});

/** Merges Tailwind class names (shadcn/ui helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
