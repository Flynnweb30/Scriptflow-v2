// Discord Configuration - Works without any setup!
// The app will show previews by default. To enable auto-sync, add your webhook URL below.

export const DISCORD_CONFIG = {
    // Leave empty to use preview mode (no setup required)
    // To enable Discord auto-sync, add your webhook URL:
    // WEBHOOK_URL: 'https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN',
    WEBHOOK_URL: '',
    
    // Enable preview mode when no webhook is configured
    SIMULATE_WITHOUT_WEBHOOK: true,
    
    // Username to appear in Discord
    USERNAME: 'ScriptFlow Pro Analytics',
    
    // Avatar URL (optional)
    AVATAR_URL: 'https://cdn.discordapp.com/embed/avatars/0.png',
    
    // Enable/disable Discord sync
    ENABLED: true
};

// Helper function to validate webhook URL
export const isValidDiscordWebhook = (url: string): boolean => {
    if (!url || url === '') return false;
    const pattern = /^https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9_-]+$/;
    return pattern.test(url);
};

// Helper function to get webhook URL with validation
export const getDiscordWebhookUrl = (): string | null => {
    const url = DISCORD_CONFIG.WEBHOOK_URL;
    if (url && url !== '' && isValidDiscordWebhook(url)) {
        return url;
    }
    return null;
};