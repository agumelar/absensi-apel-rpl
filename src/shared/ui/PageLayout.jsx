import React from 'react';
import { cn } from './cn';

export const PageContainer = ({ className = '', children }) => (
  <section className={cn('mx-auto w-full max-w-6xl p-4 md:p-6', className)}>{children}</section>
);

export const PageHeader = ({ className = '', children }) => (
  <header className={cn('mb-8 flex flex-col gap-3 md:mb-10 md:flex-row md:items-center md:justify-between', className)}>
    {children}
  </header>
);

export const PageTitle = ({ className = '', children }) => (
  <h1 className={cn('text-3xl font-black tracking-tight text-slate-900 md:text-4xl', className)}>{children}</h1>
);

export const PageSubtitle = ({ className = '', children }) => (
  <p className={cn('text-xs font-semibold uppercase tracking-[0.2em] text-blue-600', className)}>{children}</p>
);
