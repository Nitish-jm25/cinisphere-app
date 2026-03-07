export const Discover = () => {
    return (
        <div className="min-h-screen bg-background pt-28 px-4 md:px-8">
            <div className="max-w-3xl mx-auto text-center">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                    Discover Movies
                </h1>
                <p className="mt-4 text-gray-300 text-base md:text-lg">
                    Use the search bar above to find movies instantly.
                </p>
                <p className="mt-2 text-gray-500 text-sm">
                    Example: type <span className="text-gray-300 font-semibold">f</span> to see titles starting with f.
                </p>
            </div>
        </div>
    );
};
