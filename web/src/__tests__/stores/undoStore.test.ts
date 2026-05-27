import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUndoStore } from '@/stores/undoStore';
import type { TransactionResponse } from '@/types';

// このストアは payload を不透明に保持するだけで TransactionResponse の各フィールドを参照しない。
// そのため完全な形を作らず、必要な識別用フィールドだけのスタブをキャストして使う。
const sampleTransaction = {
  id: 'tx-1',
  type: 'expense',
  amount: 1200,
} as unknown as TransactionResponse;

describe('undoStore', () => {
  beforeEach(() => {
    useUndoStore.setState({ pendingUndo: null });
  });

  it('starts with no pending undo', () => {
    expect(useUndoStore.getState().pendingUndo).toBeNull();
  });

  it('stores a pending undo item', () => {
    const item = { type: 'transaction' as const, data: sampleTransaction, deleted_at: 123 };
    act(() => {
      useUndoStore.getState().setPendingUndo(item);
    });
    expect(useUndoStore.getState().pendingUndo).toEqual(item);
  });

  it('clears the pending undo item', () => {
    act(() => {
      useUndoStore.getState().setPendingUndo({
        type: 'transaction',
        data: sampleTransaction,
        deleted_at: 123,
      });
    });
    act(() => {
      useUndoStore.getState().clearUndo();
    });
    expect(useUndoStore.getState().pendingUndo).toBeNull();
  });

  it('replaces an existing pending undo with a newer one', () => {
    act(() => {
      useUndoStore.getState().setPendingUndo({
        type: 'transaction',
        data: sampleTransaction,
        deleted_at: 1,
      });
      useUndoStore.getState().setPendingUndo({
        type: 'transaction',
        data: sampleTransaction,
        deleted_at: 2,
      });
    });
    expect(useUndoStore.getState().pendingUndo?.deleted_at).toBe(2);
  });
});
