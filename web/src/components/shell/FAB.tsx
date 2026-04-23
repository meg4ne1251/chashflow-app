import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Icon } from '@/components/Icon';
import { templateApi } from '@/api/templates';
import type { TemplateResponse } from '@/types';
import { logger } from '@/utils/logger';
import './fab.css';

const yenPlain = (n: number) => '¥' + Math.abs(n).toLocaleString('ja-JP');

export default function FAB() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Top 4 most-used templates with an amount set
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateApi.list(),
    select: (r) => r.data,
    staleTime: 60_000,
  });

  const quickItems = (templates ?? [])
    .filter((t) => t.amount != null)
    .sort((a, b) => (b.use_count ?? 0) - (a.use_count ?? 0))
    .slice(0, 4);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const handleUseTemplate = (t: TemplateResponse) => {
    setOpen(false);
    templateApi.use(t.id).catch((err) => {
      logger.warn('Failed to record template usage', err, { templateId: t.id });
    });
    navigate('/transactions/new', { state: { template: t } });
  };

  return (
    <div className="shell-fab" ref={wrapRef}>
      {open && (
        <div className="shell-fab-quick" role="menu">
          <div className="shell-fab-quick-h">
            <Icon name="sparkle" size={11} />
            よく使う取引 — タップで即登録
          </div>
          {quickItems.length === 0 && (
            <div className="shell-fab-empty">テンプレートがありません</div>
          )}
          {quickItems.map((t) => (
            <button
              key={t.id}
              type="button"
              className="shell-fab-quick-item"
              onClick={() => handleUseTemplate(t)}
            >
              <div className="shell-fab-quick-icon">
                <Icon name="bookmark" size={14} />
              </div>
              <div className="shell-fab-quick-meta">
                <div className="shell-fab-quick-name">{t.name}</div>
                <div className="shell-fab-quick-sub">
                  {t.transaction_name || (t.type === 'income' ? '収入' : '支出')}
                </div>
              </div>
              {t.amount != null && (
                <div className="shell-fab-quick-amt mono">
                  {t.type === 'income' ? '+' : '−'}
                  {yenPlain(t.amount)}
                </div>
              )}
            </button>
          ))}
          <div className="shell-fab-quick-divider" />
          <button
            type="button"
            className="shell-fab-quick-item"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              navigate('/transactions/new');
            }}
          >
            <div className="shell-fab-quick-icon">
              <Icon name="edit" size={14} />
            </div>
            <div className="shell-fab-quick-meta">
              <div className="shell-fab-quick-name">詳細を入力</div>
              <div className="shell-fab-quick-sub">フルフォームを開く</div>
            </div>
            <Icon name="chev-r" size={14} />
          </button>
        </div>
      )}
      <button
        type="button"
        className="shell-fab-main"
        onClick={() => setOpen((o) => !o)}
        aria-label="取引を追加"
        aria-expanded={open}
      >
        <Icon name="plus" size={22} stroke={2.4} />
      </button>
    </div>
  );
}
