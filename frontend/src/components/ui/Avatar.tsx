import { useMemo, useState } from 'react';

import { cn } from '../../utils/cn';

interface AvatarProps {
    src?: string | null;
    name: string;
    className?: string;
    textClassName?: string;
}

const initialsForName = (name: string) => {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

export const Avatar = ({ src, name, className, textClassName }: AvatarProps) => {
    const [broken, setBroken] = useState(false);
    const initials = useMemo(() => initialsForName(name), [name]);
    const showImage = Boolean(src) && !broken;

    if (showImage) {
        return (
            <img
                src={src || ''}
                alt={name}
                className={cn('rounded-full object-cover', className)}
                loading="lazy"
                onError={() => setBroken(true)}
            />
        );
    }

    return (
        <div
            aria-label={name}
            className={cn(
                'flex items-center justify-center rounded-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black font-black text-white',
                className
            )}
        >
            <span className={cn('leading-none', textClassName)}>{initials}</span>
        </div>
    );
};
