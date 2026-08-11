'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        secondary: 'bg-white text-ink-700 border border-ink-200 shadow-sm hover:bg-ink-50',
        ghost: 'hover:bg-ink-100 hover:text-ink-900',
        destructive: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
        outline: 'border border-brand-200 bg-white text-brand-700 hover:bg-brand-50',
        success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
        whatsapp: 'bg-[#25D366] text-white shadow-sm hover:bg-[#1DA851]',
        link: 'text-brand-600 underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-10 w-10',
        iconSm: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    // Com asChild (Slot), o componente filho ÚNICO é clonado — nunca
    // adicionar filhos extras (nem `false`), senão o Radix Slot quebra
    // ("Slot failed to slot onto its children") e derruba a página.
    if (asChild) {
      // Slot do Radix não declara `disabled` no tipo; ele clona o filho e
      // repassa os atributos — o cast é necessário apenas para o TypeScript.
      const SlotComp = Slot as unknown as React.ElementType;
      return (
        <SlotComp
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          disabled={disabled || loading}
          aria-busy={loading || undefined}
          {...props}
        >
          {children}
        </SlotComp>
      );
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
