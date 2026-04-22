// Mobile-only shell additions: bottom tab bar + hamburger drawer

function BottomTabs({ active, onNav, onOpenForm }) {
  const tabs = [
    { id: "dashboard",    label: "ホーム",   icon: "dashboard" },
    { id: "transactions", label: "取引",    icon: "list" },
    { id: "__add",        label: "追加",    icon: "plus", big: true },
    { id: "analysis",     label: "分析",    icon: "chart" },
    { id: "__more",       label: "メニュー", icon: "menu" },
  ];
  return (
    <nav className="bottom-tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          className={"bottom-tab " + (active === t.id ? "active" : "")}
          onClick={() => {
            if (t.id === "__add") onOpenForm?.();
            else onNav?.(t.id);
          }}
        >
          {t.big ? (
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: "var(--accent)", color: "var(--accent-ink)",
              display: "grid", placeItems: "center",
              marginBottom: 2,
              boxShadow: "0 6px 16px -4px oklch(0.74 0.14 155 / 0.55)",
            }}>
              <Icon name={t.icon} size={20} stroke={2.4} />
            </div>
          ) : (
            <Icon name={t.icon} size={20} />
          )}
          {!t.big && <span className="lbl">{t.label}</span>}
        </button>
      ))}
    </nav>
  );
}

function MobileDrawer({ open, onClose, active, onNav }) {
  if (!open) return null;
  const Sec = ({ label, items }) => (
    <div>
      {label && <div className="nav-label">{label}</div>}
      {items.map(i => (
        <a
          key={i.id}
          className={"nav-item" + (active === i.id ? " active" : "")}
          href="#"
          onClick={(e) => { e.preventDefault(); onNav?.(i.id); onClose?.(); }}
        >
          <Icon name={i.icon} size={16} />
          <span>{i.label}</span>
        </a>
      ))}
    </div>
  );
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        <div className="brand">
          <div className="brand-mark">¥</div>
          <div>
            <div className="brand-name">家計簿</div>
            <div className="brand-sub">2026年4月</div>
          </div>
          <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name="x" size={16}/>
          </button>
        </div>
        <Sec items={[
          { id: "dashboard", label: "ダッシュボード", icon: "dashboard" },
          { id: "transactions", label: "取引一覧", icon: "list" },
          { id: "transfer", label: "振替", icon: "swap" },
        ]} />
        <Sec label="マスタ管理" items={[
          { id: "category", label: "カテゴリ", icon: "tag" },
          { id: "payment", label: "決済手段", icon: "card" },
          { id: "tags", label: "タグ", icon: "folder" },
          { id: "template", label: "テンプレート", icon: "bookmark" },
          { id: "recurring", label: "定期取引", icon: "repeat" },
        ]} />
        <Sec label="分析" items={[
          { id: "analysis", label: "分析", icon: "chart" },
          { id: "budget", label: "予算", icon: "wallet" },
          { id: "savings", label: "貯蓄目標", icon: "piggy" },
        ]} />
        <Sec items={[
          { id: "settings", label: "設定", icon: "settings" },
        ]} />
      </aside>
    </>
  );
}

window.BottomTabs = BottomTabs;
window.MobileDrawer = MobileDrawer;
