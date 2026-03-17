const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
export const isMac = ua.includes('macintosh') || ua.includes('mac os');
export const modKey = isMac ? '⌘' : 'Ctrl';
