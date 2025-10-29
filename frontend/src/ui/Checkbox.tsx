import * as React from 'react';
import { cn } from './cn';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'h-5 w-5 rounded border-neutral-300 text-primary-600',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
});
Checkbox.displayName = 'Checkbox';

export default Checkbox;


