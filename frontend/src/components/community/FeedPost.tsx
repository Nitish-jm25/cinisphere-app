import React, { useState } from 'react';
import {
    Heart, MessageCircle, Share2, Bookmark,
    MoreHorizontal, Star
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface User {
    id: string;
    name: string;
    avatar: string;
    handle: string;
}

export interface Post {
    id: string;
    user: User;
    movie: {
        id: number;
        title: string;
        poster: string;
        rating: number;
        year: string;
    };
    content: string;
    likes: number;
    comments: number;
    timeAgo: string;
    isLikedByMe?: boolean;
    isSavedByMe?: boolean;
}

interface FeedPostProps {
    post: Post;
    className?: string;
    style?: React.CSSProperties;
}

export const FeedPost = ({ post, className, style }: FeedPostProps) => {
    const [liked, setLiked] = useState(post.isLikedByMe || false);
    const [saved, setSaved] = useState(post.isSavedByMe || false);
    const [likeCount, setLikeCount] = useState(post.likes);

    const handleLike = () => {
        if (liked) {
            setLikeCount(prev => prev - 1);
            setLiked(false);
        } else {
            setLikeCount(prev => prev + 1);
            setLiked(true);
        }
    };

    return (
        <div style={style} className={cn("glassmorphism rounded-xl overflow-hidden border border-white/10 shadow-lg", className)}>

            {/* Post Header */}
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <img
                        src={post.user.avatar}
                        alt={post.user.name}
                        className="w-10 h-10 rounded-full object-cover border border-white/20"
                    />
                    <div>
                        <h4 className="font-semibold text-sm text-foreground">{post.user.name}</h4>
                        <p className="text-xs text-secondary-foreground">@{post.user.handle} • {post.timeAgo}</p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-secondary-foreground hover:text-white rounded-full">
                    <MoreHorizontal className="w-5 h-5" />
                </Button>
            </div>

            {/* Movie Reference Card (The 'Media' of the post) */}
            <div className="px-4 pb-3">
                <div className="flex gap-4 p-3 rounded-lg bg-secondary/30 border border-white/5 items-center hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <img
                        src={post.movie.poster.startsWith('http') ? post.movie.poster : `https://image.tmdb.org/t/p/w500${post.movie.poster}`}
                        alt={post.movie.title}
                        className="w-16 h-24 rounded-md object-cover shadow-md group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-lg text-white group-hover:text-primary transition-colors line-clamp-1">{post.movie.title}</h3>
                            <div className="flex items-center gap-1 bg-green-500/10 text-green-400 px-2 py-0.5 rounded text-xs font-bold">
                                <Star className="w-3 h-3 fill-current" />
                                {post.movie.rating.toFixed(1)}
                            </div>
                        </div>
                        <p className="text-secondary-foreground text-xs">{post.movie.year}</p>
                    </div>
                </div>
            </div>

            {/* Post Content */}
            <div className="px-4 pb-4">
                <p className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                </p>
            </div>

            {/* Action Bar */}
            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={handleLike}
                        className="flex items-center gap-1.5 text-secondary-foreground hover:text-red-500 transition-colors group"
                    >
                        <Heart
                            className={cn("w-6 h-6 transition-transform group-hover:scale-110", liked && "text-red-500 fill-red-500")}
                        />
                        <span className={cn("text-sm font-medium", liked && "text-red-500")}>
                            {likeCount}
                        </span>
                    </button>

                    <button className="flex items-center gap-1.5 text-secondary-foreground hover:text-white transition-colors group">
                        <MessageCircle className="w-6 h-6 transition-transform group-hover:scale-110" />
                        <span className="text-sm font-medium">{post.comments}</span>
                    </button>

                    <button className="flex items-center gap-1.5 text-secondary-foreground hover:text-primary transition-colors group">
                        <Share2 className="w-6 h-6 transition-transform group-hover:scale-110" />
                    </button>
                </div>

                <button
                    onClick={() => setSaved(!saved)}
                    className="text-secondary-foreground hover:text-white transition-all group"
                >
                    <Bookmark
                        className={cn("w-6 h-6 transition-transform group-hover:scale-110", saved && "text-white fill-white")}
                    />
                </button>
            </div>

        </div>
    );
};
