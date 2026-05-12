import { type InputHTMLAttributes, forwardRef } from 'react';
import { cn } from './cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'flex h-11 w-full rounded-sm border border-border bg-bg-elevated px-3 text-sm text-text placeholder:text-text-muted',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';
