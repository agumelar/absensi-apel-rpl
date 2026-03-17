import React from 'react';
import { cn } from './cn';

const Card = ({ className = '', children }) => (
  <div className={cn('premium-card rounded-2xl', className)}>{children}</div>
);

export const CardHeader = ({ className = '', children }) => (
  <div className={cn('px-6 pt-6 pb-3', className)}>{children}</div>
);

export const CardTitle = ({ className = '', children }) => (
  <h3 className={cn('text-base font-semibold text-slate-900', className)}>{children}</h3>
);

export const CardContent = ({ className = '', children }) => (
  <div className={cn('px-6 pb-6', className)}>{children}</div>
);

export default Card;
