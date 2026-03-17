import React from 'react';
import { cn } from './cn';

const baseClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed';

const variants = {
  primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200/70',
  secondary: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-600 border-transparent hover:bg-slate-100',
  danger: 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100',
};

const sizes = {
  sm: 'px-3 py-2 text-xs',
  md: 'px-4 py-2.5',
  lg: 'px-5 py-3',
};

const Button = ({
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    className={cn(baseClass, variants[variant] || variants.primary, sizes[size] || sizes.md, className)}
    {...props}
  />
);

export default Button;
