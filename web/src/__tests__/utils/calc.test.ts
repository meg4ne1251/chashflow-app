import { describe, it, expect } from 'vitest';
import { evaluateExpression, hasOperator } from '@/utils/calc';

describe('evaluateExpression', () => {
  it('evaluates addition', () => {
    expect(evaluateExpression('100+200')).toBe(300);
  });

  it('evaluates subtraction', () => {
    expect(evaluateExpression('500-150')).toBe(350);
  });

  it('evaluates multiplication', () => {
    expect(evaluateExpression('12*3')).toBe(36);
  });

  it('evaluates division and rounds to nearest integer', () => {
    expect(evaluateExpression('10/3')).toBe(3); // 3.333 -> 3
    expect(evaluateExpression('10/4')).toBe(3); // 2.5 -> 3 (Math.round)
  });

  it('respects operator precedence (multiply before add)', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
  });

  it('respects operator precedence (divide before subtract)', () => {
    expect(evaluateExpression('20-10/2')).toBe(15);
  });

  it('handles a single number', () => {
    expect(evaluateExpression('42')).toBe(42);
  });

  it('ignores whitespace', () => {
    expect(evaluateExpression('  100 + 200 ')).toBe(300);
  });

  it('chains multiple operations left to right', () => {
    expect(evaluateExpression('100+50-30')).toBe(120);
  });

  it('returns null for empty string', () => {
    expect(evaluateExpression('')).toBeNull();
    expect(evaluateExpression('   ')).toBeNull();
  });

  it('returns null for division by zero', () => {
    expect(evaluateExpression('10/0')).toBeNull();
  });

  it('returns null for invalid characters', () => {
    expect(evaluateExpression('10+abc')).toBeNull();
    expect(evaluateExpression('1e5')).toBeNull();
  });

  it('returns null for trailing operator', () => {
    expect(evaluateExpression('100+')).toBeNull();
  });

  it('returns null for leading operator', () => {
    expect(evaluateExpression('*5')).toBeNull();
  });

  it('returns null for consecutive operators', () => {
    expect(evaluateExpression('5++5')).toBeNull();
  });
});

describe('hasOperator', () => {
  it('detects each arithmetic operator', () => {
    expect(hasOperator('1+1')).toBe(true);
    expect(hasOperator('1-1')).toBe(true);
    expect(hasOperator('1*1')).toBe(true);
    expect(hasOperator('1/1')).toBe(true);
  });

  it('returns false for a plain number', () => {
    expect(hasOperator('1500')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(hasOperator('')).toBe(false);
  });
});
