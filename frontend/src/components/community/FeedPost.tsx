import React, { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface User {
    id: string;
    name: string;
    avatar: string;
    handle: string;
}

export interface PostComment {
    id: string;
    username: string;
    text: string;
}

export interface Post {
    id: string;
    user: User;
    imageUrl: string;
    imageUrls?: string[];
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
    onLikeToggle?: (postId: string, currentlyLiked: boolean) => Promise<void> | void;
    onAddComment?: (postId: string, content: string) => Promise<void> | void;
    onLoadComments?: (postId: string) => Promise<PostComment[]>;
    canDelete?: boolean;
    onDeletePost?: (postId: string) => Promise<void> | void;
}

export const FeedPost = ({ post, className, style, onLikeToggle, onAddComment, onLoadComments, canDelete = false, onDeletePost }: FeedPostProps) => {
    const navigate = useNavigate();
    const [liked, setLiked] = useState(post.isLikedByMe || false);
    const [saved, setSaved] = useState(post.isSavedByMe || false);
    const [likeCount, setLikeCount] = useState(post.likes);
    const [commentCount, setCommentCount] = useState(post.comments);
    const [commentText, setCommentText] = useState('');
    const [comments, setComments] = useState<PostComment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [currentImage, setCurrentImage] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const images = useMemo(() => (post.imageUrls && post.imageUrls.length ? post.imageUrls : [post.imageUrl]), [post.imageUrl, post.imageUrls]);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            if (!onLoadComments) return;
            setLoadingComments(true);
            try {
                const rows = await onLoadComments(post.id);
                if (mounted) setComments(rows);
            } catch {
                if (mounted) setComments([]);
            } finally {
                if (mounted) setLoadingComments(false);
            }
        };
        load();
        return () => {
            mounted = false;
        };
    }, [onLoadComments, post.id]);

    const handleLike = async () => {
        const nextLiked = !liked;
        setLiked(nextLiked);
        setLikeCount((prev) => (nextLiked ? prev + 1 : prev - 1));
        try {
            if (onLikeToggle) await onLikeToggle(post.id, liked);
        } catch {
            setLiked(liked);
            setLikeCount(post.likes);
        }
    };

    const handlePostComment = async () => {
        if (!commentText.trim()) return;
        try {
            if (onAddComment) await onAddComment(post.id, commentText);
            setComments((prev) => [...prev, { id: `temp-${Date.now()}`, username: 'you', text: commentText.trim() }]);
            setCommentCount((c) => c + 1);
            setCommentText('');
        } catch {
            // ignore for now
        }
    };

    const handleDelete = async () => {
        if (!onDeletePost) return;
        const confirmed = window.confirm('Delete this post?');
        if (!confirmed) return;
        setDeleting(true);
        try {
            await onDeletePost(post.id);
            setMenuOpen(false);
        } catch (error) {
            alert((error as Error).message || 'Failed to delete post');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div style={style} className={cn('glassmorphism rounded-xl overflow-hidden border border-white/10 shadow-lg', className)}>
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => navigate(`/profile/${post.user.handle}`)}>
                        <img src={post.user.avatar} alt={post.user.name} className="w-10 h-10 rounded-full object-cover border border-white/20" />
                    </button>
                    <button type="button" className="text-left" onClick={() => navigate(`/profile/${post.user.handle}`)}>
                        <h4 className="font-semibold text-sm text-foreground">{post.user.name}</h4>
                        <p className="text-xs text-secondary-foreground">@{post.user.handle} • {post.timeAgo}</p>
                    </button>
                </div>
                {canDelete && (
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-secondary-foreground hover:text-white rounded-full"
                            onClick={() => setMenuOpen((prev) => !prev)}
                        >
                            <MoreHorizontal className="w-5 h-5" />
                        </Button>
                        {menuOpen && (
                            <div className="absolute right-0 mt-2 w-40 rounded-lg border border-white/10 bg-[#111] shadow-xl z-20 overflow-hidden">
                                <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-white/10 disabled:opacity-60"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                >
                                    {deleting ? 'Deleting...' : 'Delete post'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="px-4 relative">
                <img src={images[currentImage]} alt="post" className="w-full max-h-[520px] object-cover rounded-lg border border-white/10" />
                {images.length > 1 && (
                    <>
                        <button className="absolute left-6 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full" onClick={() => setCurrentImage((i) => (i - 1 + images.length) % images.length)}>
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/50 p-2 rounded-full" onClick={() => setCurrentImage((i) => (i + 1) % images.length)}>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {images.map((_, idx) => <span key={idx} className={cn('w-2 h-2 rounded-full', idx === currentImage ? 'bg-white' : 'bg-white/40')} />)}
                        </div>
                    </>
                )}
            </div>

            <div className="px-4 py-4">
                <p className="text-sm md:text-base text-gray-200 leading-relaxed whitespace-pre-wrap">{post.content}</p>
            </div>

            <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={handleLike} className="flex items-center gap-1.5 text-secondary-foreground hover:text-red-500 transition-colors group">
                        <Heart className={cn('w-6 h-6 transition-transform group-hover:scale-110', liked && 'text-red-500 fill-red-500')} />
                        <span className={cn('text-sm font-medium', liked && 'text-red-500')}>{likeCount}</span>
                    </button>

                    <div className="flex items-center gap-1.5 text-secondary-foreground">
                        <MessageCircle className="w-6 h-6" />
                        <span className="text-sm font-medium">{commentCount}</span>
                    </div>

                    <button className="flex items-center gap-1.5 text-secondary-foreground hover:text-primary transition-colors group">
                        <Share2 className="w-6 h-6 transition-transform group-hover:scale-110" />
                    </button>
                </div>

                <button onClick={() => setSaved(!saved)} className="text-secondary-foreground hover:text-white transition-all group">
                    <Bookmark className={cn('w-6 h-6 transition-transform group-hover:scale-110', saved && 'text-white fill-white')} />
                </button>
            </div>

            <div className="px-4 pb-4 border-t border-white/10">
                <div className="max-h-36 overflow-auto space-y-1 py-3">
                    {loadingComments ? (
                        <p className="text-xs text-gray-400">Loading comments...</p>
                    ) : comments.length === 0 ? (
                        <p className="text-xs text-gray-500">No comments yet.</p>
                    ) : (
                        comments.map((c) => (
                            <p key={c.id} className="text-sm text-gray-200"><span className="font-semibold text-white mr-2">{c.username}</span>{c.text}</p>
                        ))
                    )}
                </div>
                <div className="flex gap-2">
                    <input
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm"
                    />
                    <Button size="sm" onClick={handlePostComment}>Post</Button>
                </div>
            </div>
        </div>
    );
};


