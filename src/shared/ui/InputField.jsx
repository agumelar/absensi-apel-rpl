import React from 'react';
import { cn } from './cn';

const InputField = ({ icon: Icon, className = '', ...props }) => (
  <div className={cn('flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100', className)}>
    {Icon && <Icon size={18} className="text-slate-400" />}
    <input
      className="w-full border-none bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
      {...props}
    />
  </div>
);

export default InputField;
