// ====== Dashboard view ======

function MiniSpark({ data, height = 36, color = "var(--accent)", todayIdx = null }) {
  const max = Math.max(...data, 1);
  const w = 100, h = height;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - (v / max) * (h - 4) - 2}`).join(" ");
  const area = `0,${h} ${points} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#g1)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" />
      {todayIdx != null && (
        <circle cx={todayIdx * step} cy={h - (data[todayIdx] / max) * (h - 4) - 2} r="2.4" fill={color} stroke="var(--bg-1)" strokeWidth="1.4" />
      )}
    </svg>
  );
}

function DonutRing({ value = 0.4, size = 84, stroke = 9, color = "var(--accent)", trackColor = "var(--bg-3)" }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(Math.max(value, 0), 1));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
    </svg>
  );
}

function Dashboard({ onOpenForm }) {
  // Today is Apr 19 — 19/30 of the month
  const dayProgress = 19 / 30;
  const monthBudget = 230000;
  const monthSpent = 152300;
  const spentPct = monthSpent / monthBudget;
  const onPace = monthBudget * dayProgress;
  const diff = onPace - monthSpent; // positive = under pace
  const income = 320000;
  const balance = income - monthSpent;

  return (
    <div className="content">
      {/* Notification */}
      <div className="note">
        <Icon name="bell" size={14} />
        <span><b>日用品</b>カテゴリの予算消化率が <b>90%</b>(残¥2,000)。来週まで節約モードに切り替えますか?</span>
        <span className="close"><Icon name="x" size={14} /></span>
      </div>

      {/* Hero */}
      <div className="hero">
        <div className="hero-top">
          <div>
            <div className="hero-label">今月の支出ペース</div>
            <div className={"hero-amt " + (diff < 0 ? "neg" : "")}>
              <span className="yen">¥</span>
              {monthSpent.toLocaleString("ja-JP")}
              <span style={{ fontSize: 16, color: "var(--text-3)", fontWeight: 400, fontFamily: "var(--font-sans)", marginLeft: 8 }}>
                / 予算 ¥{monthBudget.toLocaleString("ja-JP")}
              </span>
            </div>
            <div className="hero-sub">
              {diff > 0 ? (
                <>
                  <span className="chip chip-pos"><Icon name="check" size={11}/> ペースより ¥{Math.round(diff).toLocaleString("ja-JP")} 余裕あり</span>
                  <span>4月19日時点 · 残り11日</span>
                </>
              ) : (
                <span className="chip chip-warn">ペース超過</span>
              )}
            </div>
          </div>
          <div className="hero-tabs">
            <button className="hero-tab">日</button>
            <button className="hero-tab">週</button>
            <button className="hero-tab active">月</button>
            <button className="hero-tab">年</button>
          </div>
        </div>

        <div className="pace-wrap">
          <div className="pace-bar">
            <i style={{ width: `${spentPct * 100}%` }} />
            <span className="pace-marker" style={{ left: `${dayProgress * 100}%` }} />
          </div>
          <div className="pace-row" style={{ marginTop: 14 }}>
            <span className="muted">¥0</span>
            <span className="mono dim" style={{ fontSize: 11 }}>消化 {Math.round(spentPct * 100)}% · 月進捗 {Math.round(dayProgress * 100)}%</span>
            <span className="muted" style={{ textAlign: "right" }}>¥{monthBudget.toLocaleString("ja-JP")}</span>
          </div>
        </div>

        {/* Mini sparkline of daily spend */}
        <div className="spark-wrap">
          <MiniSpark data={DAILY_SPEND.slice(0, 19)} height={48} color="var(--accent)" todayIdx={18} />
          <div className="spark-axis">
            <span>4/1</span><span>4/7</span><span>4/14</span><span>今日 4/19</span>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Three stat cards */}
      <div className="grid-12">
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label"><Icon name="trend-up" size={12} /> 今月の収入</div>
              <div className="stat-amt pos mono">+¥{income.toLocaleString("ja-JP")}</div>
              <div className="muted" style={{ fontSize: 12 }}>給与1件 · 前月比 ±0%</div>
              <MiniSpark data={[300, 320, 0, 0, 0, 0, 0]} color="var(--pos)" />
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label"><Icon name="trend-dn" size={12} /> 今月の支出</div>
              <div className="stat-amt neg mono">−¥{monthSpent.toLocaleString("ja-JP")}</div>
              <div className="muted" style={{ fontSize: 12 }}>56件 · 前月比 <span className="t-down">+12%</span></div>
              <MiniSpark data={DAILY_SPEND.slice(0, 19)} color="oklch(0.78 0.13 25)" />
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label"><Icon name="yen" size={12} /> 収支バランス</div>
              <div className="stat-amt mono">+¥{balance.toLocaleString("ja-JP")}</div>
              <div className="muted" style={{ fontSize: 12 }}>月末予測 <span className="mono">+¥85,400</span></div>
              <MiniSpark data={[0, 50, 80, 60, 90, 110, 130, 160, 165]} color="var(--accent)" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-12">
        {/* Quick add */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>クイック登録 — タップで即記録</h3>
              <a className="h-action" href="#">編集</a>
            </div>
            <div className="dash-quick">
              {QUICK_ITEMS.map((q, i) => {
                const c = CATEGORIES[q.cat];
                return (
                  <button key={i} className="dash-quick-btn" title={`${q.name} を ¥${q.amt}で登録`}>
                    <CategoryIcon cat={q.cat} size={28} />
                    <div>
                      <div className="name">{q.name}</div>
                      <div className="amt mono">−¥{q.amt.toLocaleString("ja-JP")}</div>
                    </div>
                  </button>
                );
              })}
              <button className="dash-quick-btn" onClick={onOpenForm} style={{ borderStyle: "dashed", justifyContent: "center", alignItems: "center", color: "var(--text-3)" }}>
                <Icon name="plus" size={20} />
                <div className="name" style={{ color: "var(--text-3)" }}>その他を入力</div>
              </button>
            </div>
          </div>
        </div>

        {/* Accounts */}
        <div className="col-4">
          <div className="card">
            <div className="card-h">
              <h3>残高 — 決済手段別</h3>
              <a className="h-action" href="#">→</a>
            </div>
            {ACCOUNTS.map(a => (
              <div className="acct" key={a.id}>
                <div className="cat" style={{ background: "var(--bg-2)" }}>
                  <Icon name={a.icon} size={14} />
                </div>
                <div className="meta">
                  <div className="name">{a.label}</div>
                  <div className="sub">{a.sub}</div>
                </div>
                <div className={"bal mono " + (a.balance < 0 ? "t-down" : "")}>
                  {a.balance < 0 ? "−" : ""}¥{Math.abs(a.balance).toLocaleString("ja-JP")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budgets */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>予算消化率</h3>
              <a className="h-action" href="#">予算ページへ →</a>
            </div>
            {BUDGETS.slice(0, 5).map((b, i) => {
              const c = CATEGORIES[b.cat];
              const pct = b.spent / b.budget;
              const monthPace = dayProgress;
              const overPace = pct > monthPace + 0.1;
              const cls = pct >= 1 ? "neg" : pct >= 0.8 ? "warn" : "";
              const pctCls = pct >= 1 ? "over" : pct >= 0.8 ? "warn" : "";
              return (
                <div className="bud-row" key={i}>
                  <div className="bud-line">
                    <span className="lbl"><CategoryIcon cat={b.cat} size={22} /> {c.label}</span>
                    <span className="num">¥{b.spent.toLocaleString("ja-JP")} / ¥{b.budget.toLocaleString("ja-JP")}</span>
                    <span className={"pct " + pctCls}>{Math.round(pct * 100)}%</span>
                  </div>
                  <div className={"bar " + cls}>
                    <i style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                    <span className="pace" style={{ left: `${monthPace * 100}%` }} title="月進捗 63%" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Savings */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>貯蓄目標</h3>
              <a className="h-action" href="#">すべて見る →</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {SAVINGS_GOALS.slice(0, 2).map(g => {
                const pct = g.current / g.target;
                return (
                  <div key={g.id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 14, background: "var(--bg-2)", borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="goal-icon" style={{ "--goal-color": g.color, width: 36, height: 36 }}>
                        <Icon name={g.icon} size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>期日 {g.due || "—"}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <DonutRing value={pct} size={64} stroke={7} color={g.color} />
                      <div style={{ textAlign: "right" }}>
                        <div className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(pct * 100)}%</div>
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-3)" }}>
                          ¥{g.current.toLocaleString("ja-JP")}<br/>/ ¥{g.target.toLocaleString("ja-JP")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent transactions */}
        <div className="col-12">
          <div className="card">
            <div className="card-h">
              <h3>直近の取引</h3>
              <a className="h-action" href="#">すべて見る →</a>
            </div>
            <div>
              {TRANSACTIONS.slice(0, 6).map(t => {
                const c = CATEGORIES[t.cat];
                const p = PAYMENTS[t.pay];
                return (
                  <div key={t.id} className="tx-row">
                    <CategoryIcon cat={t.cat} size={36} />
                    <div>
                      <div className="tx-name">{t.name}</div>
                      <div className="tx-meta">
                        <span>{c.label}</span><span className="dot"></span>
                        <span>{p.label}</span>
                        {t.memo && <><span className="dot"></span><span className="muted">{t.memo}</span></>}
                      </div>
                    </div>
                    <span className="tx-tag">{t.date.slice(5)} {t.time}</span>
                    <span className="tx-amt neg">−¥{Math.abs(t.amt).toLocaleString("ja-JP")}</span>
                    <div className="tx-actions">
                      <button className="icon-btn"><Icon name="edit" size={14} /></button>
                      <button className="icon-btn"><Icon name="more" size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
window.MiniSpark = MiniSpark;
window.DonutRing = DonutRing;
