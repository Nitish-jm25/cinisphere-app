

export const Feed = () => {
    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-4 text-glow">Social Feed</h1>
            <p className="text-secondary-foreground mb-6">See what your friends are watching.</p>

            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 bg-card border border-border rounded-xl">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-secondary" />
                            <div>
                                <p className="font-medium text-sm">User {i}</p>
                                <p className="text-xs text-secondary-foreground">2 hours ago</p>
                            </div>
                        </div>
                        <p className="text-sm">Just watched an amazing sci-fi movie! Highly recommend.</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
