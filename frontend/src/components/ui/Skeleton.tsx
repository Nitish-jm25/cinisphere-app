import { cn } from '../../utils/cn';

interface SkeletonProps {
    className?: string;
    variant?: 'card' | 'poster' | 'text' | 'hero';
}

export const Skeleton = ({ className, variant = 'text' }: SkeletonProps) => {
    return (
        <div
            className={cn(
                "animate-pulse bg-secondary/50 rounded-md overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/5 before:to-transparent relative",
                {
                    'aspect-[2/3] w-full rounded-xl': variant === 'poster',
                    'h-full w-full rounded-xl': variant === 'card',
                    'h-4 w-full': variant === 'text',
                    'h-[60vh] w-full rounded-none': variant === 'hero',
                },
                className
            )}
        />
    );
};

export const MovieRowSkeleton = ({ count = 5 }: { count?: number }) => {
    return (
        <div className="flex gap-4 overflow-hidden py-4 px-8">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="min-w-[160px] md:min-w-[200px] flex-shrink-0 space-y-3">
                    <Skeleton variant="poster" />
                    <Skeleton className="w-3/4" />
                    <Skeleton className="w-1/2 h-3" />
                </div>
            ))}
        </div>
    );
};
