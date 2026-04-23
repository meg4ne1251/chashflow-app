import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon, type IconName } from '@/components/Icon';
import { templateApi } from '@/api/templates';
import { transactionApi } from '@/api/transactions';
import { logger } from '@/utils/logger';
import {
  NAV_MAIN,
  NAV_MASTER,
  NAV_ANALYSIS,
  NAV_SETTINGS,
  type NavItem,
} from './navConfig';
import './command-palette.css';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const ALL_NAV: NavItem[] = [...NAV_MAIN, ...NAV_MASTER, ...NAV_ANALYSIS, ...NAV_SETTINGS];

const yenPlain = (n: number) => '¥' + Math.abs(n).toLocaleString('ja-JP');

interface RowDef {
  id: string;
  icon: IconName;
  label: string;
  sub?: string;
  meta?: string;
  onSelect: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list().then((r) => r.data),
    staleTime: 60_000,
    enabled: open,
  });

  const { data: recentTransactionsPage } = useQuery({
    queryKey: ['transactions', { size: 50, sort: '-date' }],
    queryFn: () => transactionApi.list({ size: 50, sort: '-date' }).then((r) => r.data),
    staleTime: 30_000,
    enabled: open && q.length > 0,
  });
  const recentTransactions = recentTransactionsPage?.data;

  // Reset on open
  useEffect(() => {
    if (open) {
      setQ('');
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const navRows: RowDef[] = useMemo(
    () =>
      ALL_NAV.filter(
        (n) =>
          !q ||
          n.label.toLowerCase().includes(q.toLowerCase()) ||
          n.path.toLowerCase().includes(q.toLowerCase()),
      ).map((n) => ({
        id: 'nav:' + n.path,
        icon: n.icon,
        label: n.label + 'を開く',
        sub: n.path,
        onSelect: () => {
          navigate(n.path);
          onClose();
        },
      })),
    [q, navigate, onClose],
  );

  const templateRows: RowDef[] = useMemo(
    () =>
      (templates ?? [])
        .filter(
          (t) =>
            !q ||
            t.name.toLowerCase().includes(q.toLowerCase()) ||
            (t.transaction_name?.toLowerCase().includes(q.toLowerCase()) ?? false),
        )
        .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0))
        .slice(0, 6)
        .map((t) => ({
          id: 'tpl:' + t.id,
          icon: 'bookmark' as IconName,
          label: t.name,
          sub: t.transaction_name || (t.type === 'income' ? '収入テンプレ' : '支出テンプレ'),
          meta: t.amount != null ? (t.type === 'income' ? '+' : '−') + yenPlain(t.amount) : undefined,
          onSelect: () => {
            templateApi.use(t.id).catch((err) => {
              logger.warn('Failed to record template usage', err, { templateId: t.id });
            });
            navigate('/transactions/new', { state: { template: t } });
            onClose();
          },
        })),
    [templates, q, navigate, onClose],
  );

  const transactionRows: RowDef[] = useMemo(() => {
    if (!q) return [];
    const ql = q.toLowerCase();
    return (recentTransactions ?? [])
      .filter((t) =>
        (t.name || '').toLowerCase().includes(ql) ||
        (t.memo || '').toLowerCase().includes(ql),
      )
      .slice(0, 6)
      .map((t) => ({
        id: 'tx:' + t.id,
        icon: 'receipt' as IconName,
        label: t.name || '(無題)',
        sub: t.category?.name || (t.type === 'income' ? '収入' : '支出'),
        meta: (t.type === 'income' ? '+' : '−') + yenPlain(t.amount),
        onSelect: () => {
          navigate(`/transactions/${t.id}/edit`);
          onClose();
        },
      }));
  }, [recentTransactions, q, navigate, onClose]);

  // Flatten all rows for keyboard navigation
  const allRows = useMemo(
    () => [...templateRows, ...transactionRows, ...navRows],
    [templateRows, transactionRows, navRows],
  );

  useEffect(() => {
    setCursor(0);
  }, [q]);

  // Keyboard nav
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, allRows.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        allRows[cursor]?.onSelect();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, allRows, cursor]);

  if (!open) return null;

  let runningIndex = 0;
  const renderSection = (heading: string, rows: RowDef[]) => {
    if (rows.length === 0) return null;
    const startIdx = runningIndex;
    runningIndex += rows.length;
    return (
      <div className="cmdp-section">
        <div className="cmdp-section-h">{heading}</div>
        {rows.map((row, i) => {
          const idx = startIdx + i;
          return (
            <button
              key={row.id}
              type="button"
              className={'cmdp-row' + (idx === cursor ? ' active' : '')}
              onMouseEnter={() => setCursor(idx)}
              onClick={row.onSelect}
            >
              <div className="cmdp-row-icon">
                <Icon name={row.icon} size={14} />
              </div>
              <div className="cmdp-row-meta">
                <div className="cmdp-row-label">{row.label}</div>
                {row.sub && <div className="cmdp-row-sub">{row.sub}</div>}
              </div>
              {row.meta && <span className="cmdp-row-rmeta mono">{row.meta}</span>}
              {idx === cursor && <span className="kbd">↵</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="cmdp-overlay" onClick={onClose}>
      <div className="cmdp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmdp-input-row">
          <Icon name="search" size={16} style={{ color: 'var(--text-3)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="検索…  例: ランチ / ダッシュボード / 設定"
          />
          <span className="kbd">esc</span>
        </div>

        <div className="cmdp-scroll">
          {renderSection('テンプレート', templateRows)}
          {q && renderSection('最近の取引', transactionRows)}
          {renderSection('画面へ移動', navRows)}
          {allRows.length === 0 && (
            <div className="cmdp-empty">該当する項目がありません</div>
          )}
        </div>

        <div className="cmdp-foot">
          <span>
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> 移動
          </span>
          <span>
            <span className="kbd">↵</span> 実行
          </span>
          <span>
            <span className="kbd">esc</span> 閉じる
          </span>
        </div>
      </div>
    </div>
  );
}
