import { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface MinimalCardProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function MinimalCard({ children, className = '', noPadding = false }: MinimalCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg ${noPadding ? '' : 'p-6'} ${className}`}
      style={{
        backgroundColor: 'transparent',
        borderBottom: '1px solid var(--text-100)',
      }}
    >
      {children}
    </motion.div>
  );
}

interface MinimalCardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function MinimalCardHeader({ children, className = '' }: MinimalCardHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      {children}
    </div>
  );
}

interface MinimalCardTitleProps {
  children: ReactNode;
  className?: string;
}

export function MinimalCardTitle({ children, className = '' }: MinimalCardTitleProps) {
  return (
    <h3
      className={`text-lg font-semibold mb-1 ${className}`}
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        color: 'var(--text-900)',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </h3>
  );
}

interface MinimalCardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function MinimalCardDescription({ children, className = '' }: MinimalCardDescriptionProps) {
  return (
    <p
      className={`text-sm ${className}`}
      style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        color: 'var(--text-600)',
      }}
    >
      {children}
    </p>
  );
}

interface MinimalCardContentProps {
  children: ReactNode;
  className?: string;
}

export function MinimalCardContent({ children, className = '' }: MinimalCardContentProps) {
  return (
    <div className={className}>
      {children}
    </div>
  );
}
