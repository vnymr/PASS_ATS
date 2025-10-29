import * as React from 'react';
import { cn } from './cn';

export interface TabsProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: string }[];
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: TabsProps<T>) {
  return (
    <div className={cn('border-b border-neutral-200', className)}>
      <div className="-mb-px flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-t-lg transition',
                active
                  ? 'text-primary-700 border-b-2 border-primary-700'
                  : 'text-neutral-600 hover:text-neutral-800 hover:border-neutral-300 border-b-2 border-transparent',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default Tabs;


