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
    <div className={cn('flex items-center justify-between gap-4', className)} {...props}>
      <div className="flex items-center gap-2 text-neutral-800">
        {icon && <div className="text-primary-600">{icon}</div>}
        <h2 className="text-xl font-semibold">{title}</h2>
        {typeof count !== 'undefined' && (
          <span className="ml-1 text-sm text-neutral-500">{count}</span>
        )}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}

export default SectionHeader;


