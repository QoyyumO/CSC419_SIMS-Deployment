import React, { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode; // Button text or content
  size?: 'sm' | 'md' | 'full'; // Button size, 'full' expands to fill container
  variant?: 'primary' | 'outline' | 'text-only'; // Button variant, added 'text-only'
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: () => void; // Click handler
  disabled?: boolean; // Disabled state
  className?: string; // Custom className
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = 'md',
  variant = 'primary',
  startIcon,
  endIcon,
  onClick,
  className = '',
  disabled = false,
  ...rest
}) => {
  // Size Classes
  const sizeClasses = {
    sm: 'px-4 py-3 text-sm',
    md: 'px-5 py-3.5 text-sm',
    full: 'w-full px-5 py-3.5 text-sm', // full width, padding same as md
  };

  // Variant Classes
  const variantClasses = {
    primary:
      'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300',
    outline:
      'bg-white text-gray-500 border-2 border-gray-300 hover:border-brand-500 hover:text-brand-500 focus:border-brand-600 focus:text-brand-600 border-solid ring-0 shadow-none transition-colors duration-150 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:text-brand-500',
    'text-only':
      'bg-transparent text-gray-400 hover:bg-brand-50 hover:text-brand-500 focus:bg-brand-100 disabled:text-brand-300 ring-0 border-0 shadow-none', // text-only style
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 font-medium transition ${className} ${
        sizeClasses[size]
      } ${variantClasses[variant]} ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } rounded-[65px]`}
      onClick={onClick}
      disabled={disabled}
      {...rest}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;
