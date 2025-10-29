import * as React from 'react';
import { cn } from './cn';

type ButtonSize = 'sm' | 'md';
type ButtonVariant = 'solid' | 'outline' | 'ghost';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

const baseClasses = [
  'inline-flex items-center justify-center gap-2 font-medium rounded-xl',
  'transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
  'disabled:pointer-events-none disabled:opacity-50 min-w-[40px] min-h-[40px]',
];

const variantClasses: Record<ButtonVariant, string> = {
  solid: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm',
  outline: 'border border-neutral-300 text-neutral-900 hover:bg-neutral-50',
  ghost: 'text-neutral-700 hover:bg-neutral-50',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size = 'md', variant = 'solid', fullWidth = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(baseClasses, sizeClasses[size], variantClasses[variant], fullWidth && 'w-full', className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export default Button;


