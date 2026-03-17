// NOTE: iPadOS 13+ Safari は UA に 'Macintosh' を含むため Mac として検出される。
// キーボードショートカット表示用途では Bluetooth キーボード接続時の挙動として問題ない。
const ua = navigator.userAgent.toLowerCase();
export const isMac = ua.includes('macintosh') || ua.includes('mac os');
export const modKey = isMac ? '⌘' : 'Ctrl';

/**
 * 修飾キー+キーの組み合わせを OS 慣例に合わせてフォーマットする。
 * Mac: ⌘Z, ⌘Shift+] (修飾キー記号は+なしで前置)
 * Win: Ctrl+Z, Ctrl+Shift+]
 */
export const modKeyCombo = (key: string): string => (isMac ? `⌘${key}` : `Ctrl+${key}`);
