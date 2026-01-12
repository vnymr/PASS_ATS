import * as React from 'react';
import { cn } from './cn';

interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  count?: number | string;
  right?: React.ReactNode;
}

export function SectionHeader({ icon, title, count, right, className, ...props }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4', className)} {...props}>
      <div className="flex items-center gap-2 text-neutral-800">
        {icon && <div className="text-primary-600 flex-shrink-0">{icon}</div>}
        <h2 className="text-lg sm:text-xl font-semibold">{title}</h2>
        {typeof count !== 'undefined' && (
          <span className="ml-1 text-xs sm:text-sm text-neutral-500">{count}</span>
        )}
      </div>
      {right && <div className="flex items-center gap-2 w-full sm:w-auto">{right}</div>}
    </div>
  );
}

export default SectionHeader;


