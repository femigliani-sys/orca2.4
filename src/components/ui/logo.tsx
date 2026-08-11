import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  dark?: boolean;
}

/** Logotipo textual OrçaAI + marca. */
export function Logo({ className, iconOnly = false, dark = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path
            d="M12 3c1.2 0 2.2.9 2.4 2.1l.3 1.9 1.9-.4a2.5 2.5 0 0 1 2.8 1.5c.4 1-.1 2.1-1.1 2.6L15 12l2.3 1.3a2.2 2.2 0 0 1 1.1 2.6 2.5 2.5 0 0 1-2.8 1.5l-1.9-.4-.3 1.9A2.4 2.4 0 0 1 12 21a2.4 2.4 0 0 1-2.4-2.1l-.3-1.9-1.9.4a2.5 2.5 0 0 1-2.8-1.5c-.4-1 .1-2.1 1.1-2.6L8.2 12 6.7 10.7a2.2 2.2 0 0 1-1.1-2.6 2.5 2.5 0 0 1 2.8-1.5l1.9.4.3-1.9A2.4 2.4 0 0 1 12 3Z"
            fill="currentColor"
          />
          <path d="M12 7.5 13 10l2.5 1-2.5 1L12 13.5 11 12l-2.5-1L11 10l1-2.5Z" fill="#fff" opacity="0.9" />
        </svg>
      </span>
      {!iconOnly && (
        <span className={cn('text-lg font-semibold tracking-tight', dark ? 'text-white' : 'text-ink-900')}>
          Orça<span className="text-brand-600">AI</span>
        </span>
      )}
    </span>
  );
}
