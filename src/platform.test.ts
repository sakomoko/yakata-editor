import { describe, it, expect } from 'vitest';
import { isMac, modKey, modKeyCombo } from './platform.ts';

describe('platform', () => {
  // vitest の jsdom 環境では navigator.userAgent にブラウザ情報がないため isMac は false
  it('isMac は jsdom 環境では false になる', () => {
    expect(isMac).toBe(false);
  });

  it('modKey は非 Mac 環境では "Ctrl" になる', () => {
    expect(modKey).toBe('Ctrl');
  });

  describe('modKeyCombo', () => {
    // 非 Mac 環境 (jsdom) でのテスト
    it('非 Mac 環境では Ctrl+キー 形式を返す', () => {
      expect(modKeyCombo('Z')).toBe('Ctrl+Z');
    });

    it('Shift 付きの組み合わせを正しくフォーマットする', () => {
      expect(modKeyCombo('Shift+]')).toBe('Ctrl+Shift+]');
    });

    it('記号キーを正しくフォーマットする', () => {
      expect(modKeyCombo('=')).toBe('Ctrl+=');
      expect(modKeyCombo('-')).toBe('Ctrl+-');
      expect(modKeyCombo('0')).toBe('Ctrl+0');
    });
  });
});
