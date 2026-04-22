// ====== Budget page ======

// Today is Apr 22, 2026 — 22/30 of month
const TODAY_DAY = 22;
const MONTH_DAYS = 30;
const DAY_PROG = TODAY_DAY / MONTH_DAYS;
const DAYS_LEFT = MONTH_DAYS - TODAY_DAY;

function BudgetPage() {
  const totalBudget = BUDGETS.reduce((s, b) => s + b.budget, 0);
  const totalSpent  = BUDGETS.reduce((s, b) => s + b.spent, 0);
  const pct = totalSpent / totalBudget;
  const paceTarget = totalBudget * DAY_PROG;
  const diff = paceTarget - totalSpent;

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>予算管理</h1>
          <div className="sub">2026年4月 · 残り {DAYS_LEFT} 日</div>
        </div>
        <div className="actions">
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn"><Icon name="chev-l" size={14}/></button>
            <button className="btn" style={{ minWidth: 120 }}>
              <Icon name="calendar" size={13}/> 2026年4月
            </button>
            <button className="icon-btn"><Icon name="chev-r" size={14}/></button>
          </div>
          <button className="btn"><Icon name="folder" size={13}/> 前月コピー</button>
          <button className="btn btn-primary"><Icon name="plus" size={14} stroke={2.4}/> 予算追加</button>
        </div>
      </div>

      {/* Hero summary */}
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">今月の消化状況</div>
            <div className="hero-amt">
              <span className="yen">¥</span>
              {totalSpent.toLocaleString("ja-JP")}
              <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 400, fontFamily: "var(--font-sans)", marginLeft: 8 }}>
                / ¥{totalBudget.toLocaleString("ja-JP")}
              </span>
            </div>
            <div className="hero-sub">
              {diff > 0 ? (
                <span className="chip chip-pos"><Icon name="check" size={11}/> ペースより ¥{Math.round(diff).toLocaleString("ja-JP")} 余裕</span>
              ) : (
                <span className="chip chip-warn">ペース超過 ¥{Math.round(-diff).toLocaleString("ja-JP")}</span>
              )}
              <span>1日あたり残り使える額 <span className="mono" style={{ color: "var(--text-1)" }}>¥{Math.floor((totalBudget - totalSpent) / DAYS_LEFT).toLocaleString("ja-JP")}</span></span>
            </div>
          </div>
          <div className="kpi-grid">
            <div className="kpi">
              <div className="kpi-l">残額</div>
              <div className="kpi-v mono">¥{(totalBudget - totalSpent).toLocaleString("ja-JP")}</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">月末予測</div>
              <div className="kpi-v mono">¥{Math.floor(totalSpent / DAY_PROG).toLocaleString("ja-JP")}</div>
              <div className="kpi-sub chip-pos chip">予算内</div>
            </div>
            <div className="kpi">
              <div className="kpi-l">超過カテゴリ</div>
              <div className="kpi-v mono">1<span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 4 }}>/ 6</span></div>
            </div>
          </div>
        </div>
        <div className="pace-wrap">
          <div className="pace-bar">
            <i style={{ width: `${pct * 100}%` }} />
            <span className="pace-marker" style={{ left: `${DAY_PROG * 100}%` }} />
          </div>
          <div className="pace-row" style={{ marginTop: 14 }}>
            <span className="muted">消化 {Math.round(pct * 100)}%</span>
            <span className="mono dim" style={{ fontSize: 11 }}>月進捗 {Math.round(DAY_PROG * 100)}% · 4/{TODAY_DAY}</span>
            <span className="muted" style={{ textAlign: "right" }}>月末まで残 {DAYS_LEFT} 日</span>
          </div>
        </div>
      </div>

      <div style={{ height: 20 }} />

      {/* Category budget cards */}
      <div className="card-h" style={{ padding: "0 4px" }}>
        <h3>カテゴリ別 予算</h3>
        <div className="row" style={{ gap: 4 }}>
          <button className="filter-pill active">すべて</button>
          <button className="filter-pill">超過</button>
          <button className="filter-pill">要注意</button>
          <button className="filter-pill">安全</button>
        </div>
      </div>
      <div className="grid-12" style={{ marginTop: 12 }}>
        {BUDGETS.map((b, i) => <BudgetCard key={i} b={b} /> )}
      </div>

      <div style={{ height: 20 }} />

      {/* Month timeline */}
      <div className="card">
        <div className="card-h">
          <h3>月タイムライン — 日別消化の積み上げ</h3>
          <div className="muted" style={{ fontSize: 12 }}>
            <span className="legend"><i style={{ background: "var(--cat-food)" }}/>食費</span>
            <span className="legend"><i style={{ background: "var(--cat-daily)" }}/>日用品</span>
            <span className="legend"><i style={{ background: "var(--cat-transit)" }}/>交通費</span>
            <span className="legend"><i style={{ background: "var(--cat-fixed)" }}/>固定費</span>
            <span className="legend"><i style={{ background: "var(--cat-leisure)" }}/>娯楽</span>
          </div>
        </div>
        <MonthStackedBars />
      </div>
    </div>
  );
}

function BudgetCard({ b }) {
  const c = CATEGORIES[b.cat];
  const pct = b.spent / b.budget;
  const paceTarget = b.budget * DAY_PROG;
  const diff = paceTarget - b.spent;
  const remain = Math.max(0, b.budget - b.spent);
  const perDay = DAYS_LEFT > 0 ? Math.floor(remain / DAYS_LEFT) : 0;

  const status =
    pct >= 1 ? { cls: "over",  label: "超過", chipCls: "chip-neg" } :
    pct >= DAY_PROG + 0.12 ? { cls: "warn", label: "要注意", chipCls: "chip-warn" } :
    { cls: "ok", label: "安全", chipCls: "chip-pos" };

  return (
    <div className="col-4">
      <div className="card bud-card">
        <div className="bud-card-h">
          <CategoryIcon cat={b.cat} size={36} />
          <div style={{ flex: 1 }}>
            <div className="bud-card-name">{c.label}</div>
            <div className="bud-card-sub">予算 ¥{b.budget.toLocaleString("ja-JP")}</div>
          </div>
          <span className={"chip " + status.chipCls}>{status.label}</span>
          <button className="icon-btn"><Icon name="more" size={14}/></button>
        </div>

        <div className="bud-amt">
          <div className="bud-amt-main mono">
            ¥{b.spent.toLocaleString("ja-JP")}
            <span className="bud-amt-pct"> · {Math.round(pct * 100)}%</span>
          </div>
          <div className="bud-amt-sub muted">
            {pct >= 1 ? (
              <span className="t-down">¥{(b.spent - b.budget).toLocaleString("ja-JP")} 超過</span>
            ) : (
              <>残 <span className="mono" style={{ color: "var(--text-2)" }}>¥{remain.toLocaleString("ja-JP")}</span></>
            )}
          </div>
        </div>

        <div className={"bar " + status.cls}>
          <i style={{ width: `${Math.min(pct, 1.2) * 100 / 1.2 * 1.2}%` }} />
          <span className="pace" style={{ left: `${DAY_PROG * 100}%` }} />
        </div>

        <div className="bud-foot">
          <div className="bud-foot-item">
            <div className="bud-foot-l">ペース差</div>
            <div className={"bud-foot-v mono " + (diff >= 0 ? "t-up" : "t-down")}>
              {diff >= 0 ? "−" : "+"}¥{Math.abs(Math.round(diff)).toLocaleString("ja-JP")}
            </div>
          </div>
          <div className="bud-foot-item">
            <div className="bud-foot-l">1日あたり使える</div>
            <div className="bud-foot-v mono">
              {pct >= 1 ? "—" : "¥" + perDay.toLocaleString("ja-JP")}
            </div>
          </div>
          <div className="bud-foot-item">
            <div className="bud-foot-l">月末予測</div>
            <div className="bud-foot-v mono">
              ¥{Math.floor(b.spent / DAY_PROG).toLocaleString("ja-JP")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stacked-bar month timeline
function MonthStackedBars() {
  // Build synthetic stacked data per day, 22 days
  const CATS = ["food", "daily", "transit", "leisure", "fixed"];
  const seed = [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0];
  const bars = [];
  for (let d = 0; d < 22; d++) {
    const row = {};
    row.food    = 1200 + Math.round(Math.sin(d * 1.3) * 800 + 800);
    row.daily   = d % 4 === 0 ? 1800 + Math.random() * 600 : (d % 2 ? 400 : 0);
    row.transit = d % 3 === 0 ? 2000 : d % 2 ? 400 : 0;
    row.leisure = d === 5 || d === 16 ? 4200 : 0;
    row.fixed   = d === 4 ? 88800 / 3 : 0; // compressed for viz
    row.total   = CATS.reduce((s, k) => s + row[k], 0);
    bars.push(row);
  }
  const max = Math.max(...bars.map(b => b.total));
  return (
    <div className="month-bars">
      {bars.map((b, i) => (
        <div className="month-bar-col" key={i} title={`4/${i+1} 合計 ¥${Math.round(b.total).toLocaleString()}`}>
          <div className="month-bar-stack">
            {CATS.map(c => (
              <div
                key={c}
                className="month-bar-seg"
                style={{
                  height: `${(b[c] / max) * 100}%`,
                  background: `var(--cat-${c})`,
                  opacity: 0.88,
                }}
              />
            ))}
          </div>
          <div className={"month-bar-day " + (i + 1 === TODAY_DAY ? "today" : "")}>
            {i + 1}
          </div>
        </div>
      ))}
    </div>
  );
}

window.BudgetPage = BudgetPage;
