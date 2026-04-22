// ====== Transactions list page ======

const FILTERS = [
  { id: "all",   label: "すべて" },
  { id: "expense", label: "支出" },
  { id: "income",  label: "収入" },
  { id: "food",  label: "食費" },
  { id: "transit", label: "交通費" },
  { id: "fixed",  label: "固定費" },
];

function dayJp(date) {
  const d = new Date(date);
  const days = ["日","月","火","水","木","金","土"];
  return days[d.getDay()];
}

function TransactionsPage({ onOpenForm }) {
  const [filter, setFilter] = React.useState("all");
  const [q, setQ] = React.useState("");

  // Group by date
  const filtered = TRANSACTIONS.filter(t => {
    if (q && !t.name.includes(q) && !(t.memo || "").includes(q)) return false;
    if (filter === "all") return true;
    if (filter === "expense") return t.amt < 0;
    if (filter === "income") return t.amt > 0;
    return t.cat === filter;
  });
  const groups = {};
  for (const t of filtered) {
    (groups[t.date] = groups[t.date] || []).push(t);
  }

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>取引一覧</h1>
          <div className="sub">2026年4月 · 全 {filtered.length} 件</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="bookmark" size={14}/> テンプレートから</button>
          <button className="btn"><Icon name="receipt" size={14}/> レシート読込</button>
          <button className="btn btn-primary" onClick={onOpenForm}>
            <Icon name="plus" size={14} stroke={2.4}/> 新規取引
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-input">
          <Icon name="search" size={14} style={{ color: "var(--text-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="名前・メモで検索…"
          />
          <span className="kbd">⌘</span><span className="kbd">F</span>
        </div>
        {FILTERS.map(f => (
          <button
            key={f.id}
            className={"filter-pill" + (filter === f.id ? " active" : "")}
            onClick={() => setFilter(f.id)}
          >{f.label}</button>
        ))}
        <button className="filter-pill"><Icon name="calendar" size={12}/> 4月</button>
        <button className="filter-pill"><Icon name="filter" size={12}/> 詳細フィルタ</button>
      </div>

      <div className="card" style={{ padding: "8px 16px 16px" }}>
        {Object.keys(groups).map(date => {
          const total = groups[date].reduce((s, t) => s + t.amt, 0);
          const d = new Date(date);
          return (
            <div className="day-group" key={date}>
              <div className="day-head">
                <div className="day-l">
                  <span className="day-d">{d.getDate()}</span>
                  <span className="day-w">({dayJp(date)}) {d.getMonth()+1}月</span>
                  <span className="muted">{groups[date].length}件</span>
                </div>
                <div className="day-t">
                  {total < 0 ? "−" : "+"}¥{Math.abs(total).toLocaleString("ja-JP")}
                </div>
              </div>
              {groups[date].map(t => {
                const c = CATEGORIES[t.cat];
                const p = PAYMENTS[t.pay];
                return (
                  <div className="tx-row" key={t.id}>
                    <CategoryIcon cat={t.cat} size={36} />
                    <div>
                      <div className="tx-name">{t.name}</div>
                      <div className="tx-meta">
                        <span>{c.label}</span><span className="dot"></span>
                        <span>{p.label}</span>
                        {t.memo && <><span className="dot"></span><span>{t.memo}</span></>}
                        {t.id <= 7 && <span className="dot"></span>}
                        {t.id <= 7 && <span className="tx-tag" style={{ background: "var(--bg-3)" }}>{t.time}</span>}
                      </div>
                    </div>
                    <span className="tx-tag">支出</span>
                    <span className="tx-amt neg">−¥{Math.abs(t.amt).toLocaleString("ja-JP")}</span>
                    <div className="tx-actions">
                      <button className="icon-btn"><Icon name="edit" size={14}/></button>
                      <button className="icon-btn"><Icon name="more" size={14}/></button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ====== Add transaction sheet ======

function AddSheet({ open, onClose }) {
  const [type, setType] = React.useState("expense"); // expense / income / transfer
  const [amt, setAmt]   = React.useState("");
  const [cat, setCat]   = React.useState("food");
  const [pay, setPay]   = React.useState("cash");
  const [memo, setMemo] = React.useState("");
  if (!open) return null;

  const append = (s) => setAmt(a => (a + s).slice(0, 9));
  const back   = () => setAmt(a => a.slice(0, -1));

  const today = "2026/04/19 (日)";

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-h">
          <h2>取引を追加</h2>
          <div className="seg">
            <button className={(type==="expense"?"active expense":"")} onClick={() => setType("expense")}>支出</button>
            <button className={(type==="income"?"active income":"")}   onClick={() => setType("income")}>収入</button>
            <button className={(type==="transfer"?"active transfer":"")} onClick={() => setType("transfer")}>振替</button>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>

        <div className="amount-input">
          <span className="yen-sign">{type === "income" ? "+¥" : "−¥"}</span>
          <input
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
            placeholder="0"
            inputMode="numeric"
          />
        </div>

        {/* Optional calculator pad — keeps tap-input fast */}
        <div className="calc-pad">
          {["1","2","3","÷","4","5","6","×","7","8","9","−","00","0",".","+"].map((k, i) => {
            const isOp = ["÷","×","−","+"].includes(k);
            return (
              <button
                key={i}
                className={isOp ? "op" : ""}
                onClick={() => isOp ? null : append(k === "00" ? "00" : k)}
              >{k}</button>
            );
          })}
          <button onClick={back} style={{ gridColumn: "1 / span 2" }}>⌫</button>
          <button className="op" style={{ gridColumn: "3 / span 2" }}>=</button>
        </div>

        <div className="field-list">
          <div className="field">
            <span className="lbl"><Icon name="tag" size={12}/> カテゴリ</span>
            <div className="val">
              <div className="cat-pick">
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <button key={k} className={cat === k ? "on" : ""} onClick={() => setCat(k)}>
                    <Icon name={v.icon} size={12} /> {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <span className="lbl"><Icon name="card" size={12}/> 決済</span>
            <div className="val">
              <div className="cat-pick">
                {Object.entries(PAYMENTS).map(([k, v]) => (
                  <button key={k} className={pay === k ? "on" : ""} onClick={() => setPay(k)}>
                    <Icon name={v.icon} size={12} /> {v.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="field">
            <span className="lbl"><Icon name="calendar" size={12}/> 日時</span>
            <div className="val" style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input value={today} readOnly />
              <button className="filter-pill">今日</button>
              <button className="filter-pill">昨日</button>
            </div>
          </div>

          <div className="field">
            <span className="lbl"><Icon name="edit" size={12}/> メモ</span>
            <div className="val">
              <input
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="任意 (例: 同僚と)"
              />
            </div>
          </div>

          <div className="field">
            <span className="lbl"><Icon name="folder" size={12}/> タグ</span>
            <div className="val">
              <div className="cat-pick">
                {["#仕事","#家族","#接待","+ 追加"].map((t, i) => (
                  <button key={i}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="receipt-drop">
          <div className="iconbox"><Icon name="camera" size={18}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--text-1)", fontSize: 13, fontWeight: 500 }}>レシートを撮影 / ドロップ</div>
            <div>OCRで品名・金額・日付を自動入力</div>
          </div>
          <button className="btn"><Icon name="plus" size={12}/> 添付</button>
        </div>

        <div className="sheet-foot">
          <label className="save-as">
            <input type="checkbox" defaultChecked={false}/>
            よく使う取引として保存
          </label>
          <button className="btn" onClick={onClose}>キャンセル</button>
          <button className="btn btn-primary" onClick={onClose}>
            <Icon name="check" size={14} stroke={2.4}/> 登録 (⌘↵)
          </button>
        </div>
      </div>
    </div>
  );
}

// ====== Savings page ======

function SavingsPage() {
  const totalTarget = SAVINGS_GOALS.reduce((s, g) => s + g.target, 0);
  const totalCur = SAVINGS_GOALS.reduce((s, g) => s + g.current, 0);
  const overall = totalCur / totalTarget;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>貯蓄目標</h1>
          <div className="sub">{SAVINGS_GOALS.length} 件 · 全体進捗 {Math.round(overall * 100)}%</div>
        </div>
        <div className="actions">
          <button className="btn"><Icon name="filter" size={14}/> すべて</button>
          <button className="btn btn-primary"><Icon name="plus" size={14} stroke={2.4}/> 目標を追加</button>
        </div>
      </div>

      {/* Summary hero */}
      <div className="hero" style={{ padding: "20px 24px" }}>
        <div className="hero-top">
          <div>
            <div className="hero-label">現在の積立総額</div>
            <div className="hero-amt">
              <span className="yen">¥</span>
              {totalCur.toLocaleString("ja-JP")}
              <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 400, fontFamily: "var(--font-sans)", marginLeft: 8 }}>
                / 目標 ¥{totalTarget.toLocaleString("ja-JP")}
              </span>
            </div>
            <div className="hero-sub">
              <span className="chip chip-pos">今月 +¥45,000 積立</span>
              <span>達成1件 · 進行中3件</span>
            </div>
          </div>
        </div>
        <div className="pace-wrap">
          <div className="pace-bar">
            <i style={{ width: `${overall * 100}%` }} />
          </div>
          <div className="pace-row" style={{ marginTop: 14 }}>
            <span className="muted">¥0</span>
            <span className="mono dim" style={{ fontSize: 11 }}>{Math.round(overall * 100)}% 達成</span>
            <span className="muted" style={{ textAlign: "right" }}>¥{totalTarget.toLocaleString("ja-JP")}</span>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-12">
        {SAVINGS_GOALS.map(g => {
          const pct = g.current / g.target;
          const monthlyNeeded = g.due
            ? Math.ceil((g.target - g.current) / Math.max(1, monthsUntil(g.due)))
            : 0;
          return (
            <div className="col-6" key={g.id}>
              <div className="goal-card">
                <div className="goal-h">
                  <div className="goal-icon" style={{ "--goal-color": g.color }}>
                    <Icon name={g.icon} size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="goal-name">{g.name}</div>
                    <div className="goal-due">
                      {g.due ? `期日 ${g.due} まで残り ${monthsUntil(g.due)} ヶ月` : "期日なし"}
                    </div>
                  </div>
                  {g.done ? (
                    <span className="chip chip-pos"><Icon name="check" size={11}/> 達成</span>
                  ) : (
                    <>
                      <button className="btn"><Icon name="plus" size={12}/> 積立</button>
                      <button className="icon-btn"><Icon name="more" size={14}/></button>
                    </>
                  )}
                </div>

                <div className="goal-ring">
                  <DonutRing value={pct} size={96} stroke={10} color={g.color} />
                  <div style={{ flex: 1 }}>
                    <div className="goal-stats">
                      <div className="cur">¥{g.current.toLocaleString("ja-JP")}</div>
                      <div className="tgt">/ ¥{g.target.toLocaleString("ja-JP")} 目標</div>
                    </div>
                    <div className="bar" style={{ marginTop: 12 }}>
                      <i style={{ width: `${pct * 100}%`, background: g.color }} />
                    </div>
                    <div className="goal-meta" style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
                      <span>残り <span className="mono">¥{Math.max(0, g.target - g.current).toLocaleString("ja-JP")}</span></span>
                      {monthlyNeeded > 0 && (
                        <span className="chip chip-info">月あたり推奨 ¥{monthlyNeeded.toLocaleString("ja-JP")}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function monthsUntil(dateStr) {
  const target = new Date(dateStr);
  const today = new Date("2026-04-19");
  return Math.max(1, (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth()));
}

window.TransactionsPage = TransactionsPage;
window.AddSheet = AddSheet;
window.SavingsPage = SavingsPage;
