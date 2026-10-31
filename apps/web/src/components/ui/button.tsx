import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Every button: tone shift, 1 px lift and a larger shadow on hover; 98% on press; focus ring.
// Never in risk colors (BR-10).
export const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium',
    'transition-[background-color,border-color,box-shadow,transform,color] duration-150 ease-vz',
    'hover:-translate-y-px active:translate-y-0 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-45 disabled:shadow-none',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-navy-900 text-panel shadow-panel hover:bg-navy-700 hover:shadow-float',
        secondary:
          'border border-line bg-panel text-ink shadow-panel hover:border-line-strong/40 hover:bg-navy-tint hover:shadow-float',
        ghost: 'text-ink hover:bg-navy-tint',
        quiet: 'text-muted hover:bg-navy-tint hover:text-ink',
      },
      size: {
        sm: 'h-8 px-3 text-caption',
        md: 'h-10 px-4 text-body',
        lg: 'h-12 px-6 text-body',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
}
