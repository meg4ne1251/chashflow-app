// ====== Shell components: Sidebar / Topbar / FAB / Command Palette ======

const NAV_MAIN = [
  { id: "dashboard", label: "ダッシュボード", icon: "dashboard" },
  { id: "transactions", label: "取引一覧", icon: "list" },
  { id: "transfer", label: "振替", icon: "swap" },
];
const NAV_MASTER = [
  { id: "category", label: "カテゴリ", icon: "tag" },
  { id: "payment", label: "決済手段", icon: "card" },
  { id: "tags", label: "タグ", icon: "folder" },
  { id: "template", label: "テンプレート", icon: "bookmark" },
  { id: "recurring", label: "定期取引", icon: "repeat" },
];
const NAV_ANALYSIS = [
  { id: "analysis", label: "分析", icon: "chart" },
  { id: "budget", label: "予算", icon: "wallet", badge: "90%" },
  { id: "savings", label: "貯蓄目標", icon: "piggy" },
];

function Sidebar({ active, onNav }) {
  const Item = ({ item }) => (
    <a
      className={"nav-item" + (active === item.id ? " active" : "")}
      href="#"
      onClick={(e) => { e.preventDefault(); onNav?.(item.id); }}
    >
      <Icon name={item.icon} size={16} className="ico" />
      <span>{item.label}</span>
      {item.badge && <span className="badge">{item.badge}</span>}
    </a>
  );
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">¥</div>
        <div>
          <div className="brand-name">家計簿</div>
          <div className="brand-sub">2026年4月</div>
        </div>
      </div>

      <div className="nav-section">
        {NAV_MAIN.map(i => <Item key={i.id} item={i} />)}
      </div>

      <div className="nav-section">
        <div className="nav-label">マスタ管理</div>
        {NAV_MASTER.map(i => <Item key={i.id} item={i} />)}
      </div>

      <div className="nav-section">
        <div className="nav-label">分析</div>
        {NAV_ANALYSIS.map(i => <Item key={i.id} item={i} />)}
      </div>

      <div style={{ flex: 1 }} />

      <div className="nav-section">
        <Item item={{ id: "settings", label: "設定", icon: "settings" }} />
      </div>

      <div className="cmd-hint">
        <Icon name="command" size={14} />
        <span>クイック検索</span>
        <span style={{ marginLeft: "auto" }}>
          <span className="kbd">⌘</span> <span className="kbd">K</span>
        </span>
      </div>
    </aside>
  );
}

function Topbar({ title, sub, right, onCmd, onMenu }) {
  return (
    <div className="topbar">
      <button className="icon-btn topbar-mobile-menu" onClick={onMenu} style={{ display: "none" }}>
        <Icon name="menu" size={18} />
      </button>
      <div className="crumb"><b>{title}</b>{sub && <> · <span>{sub}</span></>}</div>
      <div className="topbar-spacer" />
      <button className="searchbar" onClick={onCmd}>
        <Icon name="search" size={14} />
        <span>取引・カテゴリを検索</span>
        <span className="kbd">⌘</span><span className="kbd">K</span>
      </button>
      {right}
      <button className="icon-btn">
        <Icon name="bell" size={16} />
        <span className="dot"></span>
      </button>
      <button className="icon-btn"><Icon name="settings" size={16} /></button>
      <div className="avatar">YT</div>
    </div>
  );
}

function CategoryIcon({ cat, size = 32 }) {
  const c = CATEGORIES[cat] || CATEGORIES.other;
  return (
    <div className="cat" style={{ width: size, height: size, "--cat-color": c.color }}>
      <Icon name={c.icon} size={Math.round(size * 0.5)} />
    </div>
  );
}

function FAB({ onOpenForm }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="fab" onMouseLeave={() => setOpen(false)}>
      {open && (
        <div className="fab-quick">
          <div className="fab-quick-h">
            <Icon name="sparkle" size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
            よく使う取引 — タップで即登録
          </div>
          {QUICK_ITEMS.map((q, i) => {
            const c = CATEGORIES[q.cat];
            return (
              <button key={i} className="quick-item" style={{ width: "100%", border: "none", background: "transparent", textAlign: "left" }}>
                <CategoryIcon cat={q.cat} size={28} />
                <div className="meta">
                  <div className="name">{q.name}</div>
                  <div className="sub">{c.label} · {PAYMENTS[q.pay].label}</div>
                </div>
                <div className="amt mono">−{yenPlain(q.amt)}</div>
              </button>
            );
          })}
          <div style={{ borderTop: "1px solid var(--border-soft)", marginTop: 6, paddingTop: 6 }}>
            <button
              className="quick-item"
              style={{ width: "100%", border: "none", background: "transparent", textAlign: "left", color: "var(--text-2)" }}
              onClick={(e) => { e.stopPropagation(); setOpen(false); onOpenForm?.(); }}
            >
              <div className="cat" style={{ background: "var(--bg-3)" }}>
                <Icon name="edit" size={14} />
              </div>
              <div className="meta">
                <div className="name">詳細を入力</div>
                <div className="sub">フルフォームを開く</div>
              </div>
              <Icon name="chev-r" size={14} />
            </button>
          </div>
        </div>
      )}
      <button
        className="fab-main"
        onMouseEnter={() => setOpen(true)}
        onClick={() => setOpen(o => !o)}
        title="取引を追加"
      >
        <Icon name="plus" size={22} stroke={2.4} />
      </button>
    </div>
  );
}

// ====== Command palette ======
function CommandPalette({ open, onClose }) {
  const [q, setQ] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Parse natural-language input like "コーヒー 500" or "ランチ 980 食費"
  const parsed = React.useMemo(() => {
    if (!q.trim()) return null;
    const m = q.match(/(.+?)\s*(\d{2,7})\s*(?:円)?\s*(\S+)?$/);
    if (!m) return null;
    const [, name, amt, catWord] = m;
    let cat = "other";
    const haystack = (name + " " + (catWord || "")).toLowerCase();
    for (const [k, v] of Object.entries(CATEGORIES)) {
      if (haystack.includes(v.label) || haystack.includes(k)) { cat = k; break; }
    }
    if (cat === "other") {
      if (/コーヒー|ランチ|ご飯|食|飲|スーパー|コンビニ/.test(haystack)) cat = "food";
      else if (/電車|バス|タクシー|交通|suica|定期/i.test(haystack)) cat = "transit";
      else if (/家賃|電気|水道|ガス|通信|wifi|netflix/i.test(haystack)) cat = "fixed";
      else if (/映画|ライブ|遊|娯楽|game/i.test(haystack)) cat = "leisure";
    }
    return { name: name.trim(), amt: parseInt(amt, 10), cat };
  }, [q]);

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // toggle handled by parent
      }
    };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <Icon name="sparkle" size={16} style={{ color: "var(--accent)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="例: ランチ 980  /  Suica 3000 交通費  /  コンビニコーヒー 180"
          />
          <span className="kbd">esc</span>
        </div>

        {parsed ? (
          <div className="cmd-section">
            <div className="cmd-section-h">入力プレビュー</div>
            <div className="cmd-preview">
              <CategoryIcon cat={parsed.cat} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{parsed.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                  {CATEGORIES[parsed.cat].label} · 現金 · 今日
                </div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: "var(--neg)" }}>
                −{yenPlain(parsed.amt)}
              </div>
              <button className="btn btn-primary"><Icon name="check" size={14} />登録</button>
            </div>
          </div>
        ) : (
          <>
            <div className="cmd-section">
              <div className="cmd-section-h">クイック登録</div>
              {QUICK_ITEMS.map((it, i) => (
                <div className="cmd-row" key={i}>
                  <CategoryIcon cat={it.cat} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{it.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {CATEGORIES[it.cat].label} · {PAYMENTS[it.pay].label}
                    </div>
                  </div>
                  <span className="mono" style={{ color: "var(--text-2)" }}>−{yenPlain(it.amt)}</span>
                  <span className="kbd">↵</span>
                </div>
              ))}
            </div>
            <div className="cmd-section">
              <div className="cmd-section-h">画面へ移動</div>
              {[
                { i: "dashboard", l: "ダッシュボード" },
                { i: "list", l: "取引一覧" },
                { i: "chart", l: "分析" },
                { i: "wallet", l: "予算管理" },
              ].map((p, i) => (
                <div className="cmd-row" key={i}>
                  <div className="cat"><Icon name={p.i} size={14} /></div>
                  <div style={{ flex: 1, fontSize: 13 }}>{p.l}を開く</div>
                  <span className="kbd">↵</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="cmd-foot">
          <span><span className="kbd">↑</span><span className="kbd">↓</span> 移動</span>
          <span><span className="kbd">↵</span> 実行</span>
          <span style={{ marginLeft: "auto" }}>自然言語で「品名 金額 カテゴリ」と入力</span>
        </div>
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.CategoryIcon = CategoryIcon;
window.FAB = FAB;
window.CommandPalette = CommandPalette;
window.NAV_MAIN = NAV_MAIN;
