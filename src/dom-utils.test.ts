// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isTextInput } from './dom-utils';

describe('isTextInput', () => {
  it('INPUT要素でtrueを返す', () => {
    const el = document.createElement('input');
    expect(isTextInput(el)).toBe(true);
  });

  it('TEXTAREA要素でtrueを返す', () => {
    const el = document.createElement('textarea');
    expect(isTextInput(el)).toBe(true);
  });

  it('SELECT要素でtrueを返す', () => {
    const el = document.createElement('select');
    expect(isTextInput(el)).toBe(true);
  });

  it('contenteditable要素でtrueを返す', () => {
    const el = document.createElement('div');
    // jsdom は isContentEditable を正しく実装していないため、
    // プロパティを直接定義してテストする
    Object.defineProperty(el, 'isContentEditable', { value: true });
    expect(isTextInput(el)).toBe(true);
  });

  it('通常のDIV要素でfalseを返す', () => {
    const el = document.createElement('div');
    expect(isTextInput(el)).toBe(false);
  });

  it('BUTTON要素でfalseを返す', () => {
    const el = document.createElement('button');
    expect(isTextInput(el)).toBe(false);
  });

  it('nullでfalseを返す', () => {
    expect(isTextInput(null)).toBe(false);
  });
});
