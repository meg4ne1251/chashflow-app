import { useNavigate } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icon';

interface MenuItem {
  label: string;
  path: string;
  icon: IconName;
  hue: string;
}

const menuItems: MenuItem[] = [
  { label: '振替', path: '/transfers', icon: 'swap', hue: 'oklch(0.72 0.13 240)' },
  { label: 'カテゴリ', path: '/categories', icon: 'folder', hue: 'oklch(0.72 0.13 320)' },
  { label: '決済手段', path: '/accounts', icon: 'card', hue: 'oklch(0.72 0.13 155)' },
  { label: 'タグ', path: '/tags', icon: 'tag', hue: 'oklch(0.72 0.13 70)' },
  { label: 'テンプレート', path: '/templates', icon: 'bookmark', hue: 'oklch(0.72 0.13 200)' },
  { label: '定期取引', path: '/recurring', icon: 'repeat', hue: 'oklch(0.72 0.13 290)' },
  { label: '予算', path: '/budgets', icon: 'wallet', hue: 'oklch(0.72 0.16 25)' },
  { label: '貯蓄目標', path: '/savings-goals', icon: 'piggy', hue: 'oklch(0.72 0.13 155)' },
  { label: '通知履歴', path: '/notifications', icon: 'bell', hue: 'oklch(0.72 0.14 75)' },
  { label: '設定', path: '/settings', icon: 'settings', hue: 'oklch(0.72 0.01 250)' },
];

export default function MoreMenuPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="page-h">
        <div>
          <h1>メニュー</h1>
          <div className="sub">マスタ管理 / 分析 / 設定</div>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 8,
        }}
      >
        {menuItems.map((item) => (
          <button
            type="button"
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-soft)',
              borderRadius: 12,
              padding: '14px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              color: 'var(--text-1)',
              fontFamily: 'inherit',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                display: 'grid',
                placeItems: 'center',
                background: `color-mix(in oklch, ${item.hue} 18%, transparent)`,
                color: item.hue,
              }}
            >
              <Icon name={item.icon} size={20} />
            </span>
            <span
              style={{
                fontSize: 12,
                lineHeight: 1.2,
                color: 'var(--text-2)',
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
