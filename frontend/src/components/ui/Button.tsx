import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none',
                    {
                        'bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[#b0070f]': variant === 'primary',
                        'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]': variant === 'secondary',
                        'border border-[var(--border)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]': variant === 'outline',
                        'hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]': variant === 'ghost',
                        'h-9 px-3': size === 'sm',
                        'h-10 py-2 px-4': size === 'md',
                        'h-11 px-8': size === 'lg',
                    },
                    className
                )}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';
