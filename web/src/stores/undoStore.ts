import { create } from 'zustand';
import type { TransactionResponse, TransferResponse } from '@/types';

interface UndoItem {
  type: 'transaction' | 'transfer';
  data: TransactionResponse | TransferResponse;
  deleted_at: number;
}

interface UndoState {
  pendingUndo: UndoItem | null;
  setPendingUndo: (item: UndoItem | null) => void;
  clearUndo: () => void;
}

export const useUndoStore = create<UndoState>()((set) => ({
  pendingUndo: null,

  setPendingUndo: (item) => set({ pendingUndo: item }),

  clearUndo: () => set({ pendingUndo: null }),
}));
