export const shareUrl = async (title: string, text: string, url: string): Promise<void> => {
    try {
        if (navigator.share) {
            await navigator.share({ title, text, url });
            return;
        }
    } catch {
        // If native share is cancelled/fails, fallback to clipboard below.
    }

    try {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
    } catch {
        window.prompt('Copy this link:', url);
    }
};
