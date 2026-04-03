import { describe, it, expect } from 'vitest';
import { isTextInput } from './dom-utils';

// HTMLElement が存在しない環境用のヘルパー
// vitest のデフォルト環境(node)では DOM API が無いため、
// グローバルに最低限の HTMLElement を定義してテストする
class MockHTMLElement {
  tagName: string;
  isContentEditable: boolean;

  constructor(tagName: string, contentEditable = false) {
    this.tagName = tagName;
    this.isContentEditable = contentEditable;
  }
}

// グローバルに HTMLElement を設定（isTextInput 内の instanceof チェック用）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).HTMLElement = MockHTMLElement;

describe('isTextInput', () => {
  it('INPUT要素でtrueを返す', () => {
    const el = new MockHTMLElement('INPUT');
    expect(isTextInput(el as unknown as Element)).toBe(true);
  });

  it('TEXTAREA要素でtrueを返す', () => {
    const el = new MockHTMLElement('TEXTAREA');
    expect(isTextInput(el as unknown as Element)).toBe(true);
  });

  it('SELECT要素でtrueを返す', () => {
    const el = new MockHTMLElement('SELECT');
    expect(isTextInput(el as unknown as Element)).toBe(true);
  });

  it('contenteditable要素でtrueを返す', () => {
    const el = new MockHTMLElement('DIV', true);
    expect(isTextInput(el as unknown as Element)).toBe(true);
  });

  it('通常のDIV要素でfalseを返す', () => {
    const el = new MockHTMLElement('DIV');
    expect(isTextInput(el as unknown as Element)).toBe(false);
  });

  it('BUTTON要素でfalseを返す', () => {
    const el = new MockHTMLElement('BUTTON');
    expect(isTextInput(el as unknown as Element)).toBe(false);
  });

  it('nullでfalseを返す', () => {
    expect(isTextInput(null)).toBe(false);
  });
});
