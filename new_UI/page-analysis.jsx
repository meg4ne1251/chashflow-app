// ====== Analysis page ======

// 30-day daily totals for Apr 2026 (22 days so far)
const APR_DAILY = DAILY_SPEND.slice(0, 22);
// Prior month (Mar 2026) for YoY / MoM comparisons
const MAR_DAILY = [2800, 1500, 800, 3800, 2400, 7100, 3000, 1100, 400, 2100, 3700, 5500, 2200, 1400, 2800, 3500, 2100, 1200, 4500, 6800, 200, 2700, 1600, 4900, 7200, 1900, 1200, 3800, 3100, 0];

// Category totals this month (derived to match dashboard)
const CAT_STATS = [
  { cat: "fixed",   spent: 88800,  prev: 82000,  count: 3 },
  { cat: "food",    spent: 7500,   prev: 9800,   count: 18 },
  { cat: "transit", spent: 15500,  prev: 13000,  count: 4 },
  { cat: "daily",   spent: 18000,  prev: 11200,  count: 7 },
  { cat: "leisure", spent: 5690,   prev: 8200,   count: 4 },
  { cat: "other",   spent: 20000,  prev: 4800,   count: 2 },
];
const MONTH_TOTAL = CAT_STATS.reduce((s, c) => s + c.spent, 0);
const PREV_TOTAL  = CAT_STATS.reduce((s, c) => s + c.prev, 0);

function AnalysisPage() {
  const [range, setRange] = React.useState("month"); // month, year, compare

  return (
    <div className="content">
      <div className="page-h">
        <div>
          <h1>分析</h1>
          <div className="sub">消費パターンから「使いすぎ」を発見</div>
        </div>
        <div className="actions">
          <div className="row" style={{ gap: 4 }}>
            <button className="icon-btn"><Icon name="chev-l" size={14}/></button>
            <button className="btn" style={{ minWidth: 120 }}>
              <Icon name="calendar" size={13}/> 2026年4月
            </button>
            <button className="icon-btn"><Icon name="chev-r" size={14}/></button>
          </div>
          <div className="hero-tabs">
            <button className={"hero-tab " + (range === "month" ? "active" : "")} onClick={() => setRange("month")}>月次</button>
            <button className={"hero-tab " + (range === "year"  ? "active" : "")} onClick={() => setRange("year")}>年次</button>
            <button className={"hero-tab " + (range === "compare" ? "active" : "")} onClick={() => setRange("compare")}>月比較</button>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid-12">
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label"><Icon name="trend-dn" size={12}/> 今月の支出</div>
              <div className="stat-amt mono">¥{MONTH_TOTAL.toLocaleString("ja-JP")}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                前月比 <span className={MONTH_TOTAL > PREV_TOTAL ? "t-down" : "t-up"}>
                  {MONTH_TOTAL > PREV_TOTAL ? "+" : "−"}{Math.abs(Math.round((MONTH_TOTAL / PREV_TOTAL - 1) * 100))}%
                </span>
                <span className="mono" style={{ marginLeft: 6, color: "var(--text-3)" }}>({MONTH_TOTAL > PREV_TOTAL ? "+" : "−"}¥{Math.abs(MONTH_TOTAL - PREV_TOTAL).toLocaleString("ja-JP")})</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label"><Icon name="clock" size={12}/> 1日あたり平均</div>
              <div className="stat-amt mono">¥{Math.round(MONTH_TOTAL / TODAY_DAY).toLocaleString("ja-JP")}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                前月平均 <span className="mono">¥{Math.round(PREV_TOTAL / 30).toLocaleString("ja-JP")}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-4">
          <div className="card">
            <div className="stat">
              <div className="stat-label"><Icon name="receipt" size={12}/> 取引件数</div>
              <div className="stat-amt mono">{CAT_STATS.reduce((s, c) => s + c.count, 0)}<span style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 400, marginLeft: 4 }}>件</span></div>
              <div className="muted" style={{ fontSize: 12 }}>
                平均単価 <span className="mono">¥{Math.round(MONTH_TOTAL / CAT_STATS.reduce((s, c) => s + c.count, 0)).toLocaleString("ja-JP")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      {/* Main time-series chart */}
      <div className="card">
        <div className="card-h">
          <h3>日別支出推移 — 今月 vs 前月</h3>
          <div className="row" style={{ gap: 12 }}>
            <span className="legend"><i style={{ background: "var(--accent)" }}/>2026年4月</span>
            <span className="legend"><i style={{ background: "var(--text-4)", opacity: 0.6 }}/>2026年3月</span>
            <span className="legend"><i className="dash" style={{ background: "transparent", borderBottom: "1.5px dashed var(--accent-strong)" }}/>7日移動平均</span>
          </div>
        </div>
        <ComparisonChart />
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-12">
        {/* Category breakdown */}
        <div className="col-8">
          <div className="card">
            <div className="card-h">
              <h3>カテゴリ内訳 — 前月比</h3>
              <a className="h-action" href="#">詳細 →</a>
            </div>
            <CategoryBreakdown />
          </div>
        </div>

        {/* Donut + top % */}
        <div className="col-4">
          <div className="card">
            <div className="card-h">
              <h3>支出構成比</h3>
            </div>
            <DonutBreakdown />
          </div>
        </div>

        {/* Weekday heatmap */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>曜日 × 時間帯 ヒートマップ</h3>
              <span className="muted" style={{ fontSize: 11 }}>濃い = 使いがち</span>
            </div>
            <WeekdayHeatmap />
          </div>
        </div>

        {/* Top merchants */}
        <div className="col-6">
          <div className="card">
            <div className="card-h">
              <h3>大口取引 TOP 5</h3>
              <a className="h-action" href="#">すべて →</a>
            </div>
            <TopTransactions />
          </div>
        </div>

        {/* Insight cards */}
        <div className="col-12">
          <div className="card">
            <div className="card-h">
              <h3>
                <Icon name="sparkle" size={13} style={{ color: "var(--accent)", verticalAlign: -2, marginRight: 6 }} />
                今月のインサイト
              </h3>
            </div>
            <div className="insight-grid">
              <InsightCard
                tone="warn"
                icon="trend-up"
                title="日用品の支出が前月比 +61%"
                body="主にドラッグストアでの大口購入 (¥2,380) が要因。来月は週次予算 ¥5,000 で分散を推奨。"
                metric="+¥6,800"
              />
              <InsightCard
                tone="pos"
                icon="trend-dn"
                title="食費は前月比 −23%"
                body="ランチ回数が減少 (12→8回)。外食より自炊比率が向上しています。"
                metric="−¥2,300"
              />
              <InsightCard
                tone="info"
                icon="repeat"
                title="定期支出が 5 件検出"
                body="Netflix / 家賃 / 電気代 / Spotify / 電車定期。月額合計 ¥103,790。"
                metric="¥103,790"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Line+area comparison chart (SVG)
function ComparisonChart() {
  const W = 800, H = 260, pad = { l: 44, r: 20, t: 16, b: 28 };
  const data = APR_DAILY;
  const prev = MAR_DAILY;
  const N = 30;
  const max = Math.max(...data, ...prev, 10000);
  const xs = (i) => pad.l + (i / (N - 1)) * (W - pad.l - pad.r);
  const ys = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);

  const aprPoints = data.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
  const marPoints = prev.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");
  const aprArea = `${xs(0)},${H - pad.b} ${aprPoints} ${xs(data.length - 1)},${H - pad.b}`;

  // 7-day moving avg for apr
  const ma = data.map((_, i) => {
    const lo = Math.max(0, i - 6);
    const slice = data.slice(lo, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
  const maPoints = ma.map((v, i) => `${xs(i)},${ys(v)}`).join(" ");

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 280 }}>
        <defs>
          <linearGradient id="aprG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Y gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
          const y = pad.t + p * (H - pad.t - pad.b);
          const v = Math.round(max * (1 - p));
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--border-soft)" strokeDasharray="2 3" />
              <text x={pad.l - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-4)" fontFamily="var(--font-mono)">
                {v >= 1000 ? `${Math.round(v/1000)}k` : v}
              </text>
            </g>
          );
        })}
        {/* Today marker */}
        <line x1={xs(TODAY_DAY - 1)} x2={xs(TODAY_DAY - 1)} y1={pad.t} y2={H - pad.b} stroke="var(--accent-strong)" strokeDasharray="3 3" opacity="0.5" />
        <rect x={xs(TODAY_DAY - 1) - 20} y={pad.t - 2} width="40" height="14" rx="3" fill="var(--bg-3)" />
        <text x={xs(TODAY_DAY - 1)} y={pad.t + 8} textAnchor="middle" fontSize="9" fill="var(--text-2)">今日</text>

        {/* Prev month (dim) */}
        <polyline points={marPoints} fill="none" stroke="var(--text-4)" strokeWidth="1.3" opacity="0.55" />

        {/* This month area + line */}
        <polygon points={aprArea} fill="url(#aprG)" />
        <polyline points={aprPoints.split(" ").slice(0, TODAY_DAY).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />

        {/* Moving avg */}
        <polyline points={maPoints.split(" ").slice(0, TODAY_DAY).join(" ")} fill="none" stroke="var(--accent-strong)" strokeWidth="1.3" strokeDasharray="4 3" />

        {/* Data dots today */}
        <circle cx={xs(TODAY_DAY - 1)} cy={ys(data[TODAY_DAY - 1])} r="4" fill="var(--accent)" stroke="var(--bg-1)" strokeWidth="2" />

        {/* X axis labels */}
        {[0, 6, 13, 20, 27, 29].map((d) => (
          <text key={d} x={xs(d)} y={H - pad.b + 14} textAnchor="middle" fontSize="10" fill="var(--text-4)">
            {d + 1}日
          </text>
        ))}
      </svg>
    </div>
  );
}

function CategoryBreakdown() {
  const sorted = [...CAT_STATS].sort((a, b) => b.spent - a.spent);
  const max = Math.max(...sorted.map(c => Math.max(c.spent, c.prev)));
  return (
    <div>
      {sorted.map((s, i) => {
        const c = CATEGORIES[s.cat];
        const delta = s.spent - s.prev;
        const deltaPct = s.prev > 0 ? Math.round((s.spent / s.prev - 1) * 100) : 0;
        return (
          <div key={i} className="catbr-row">
            <CategoryIcon cat={s.cat} size={30} />
            <div className="catbr-name">
              <div className="catbr-name-t">{c.label}</div>
              <div className="catbr-name-s muted">{s.count} 件 · 平均 <span className="mono">¥{Math.round(s.spent / s.count).toLocaleString("ja-JP")}</span></div>
            </div>
            <div className="catbr-bars">
              <div className="catbr-bar-row">
                <span className="catbr-pill">今月</span>
                <div className="catbr-track"><i style={{ width: `${(s.spent / max) * 100}%`, background: c.color }} /></div>
                <span className="catbr-val mono">¥{s.spent.toLocaleString("ja-JP")}</span>
              </div>
              <div className="catbr-bar-row">
                <span className="catbr-pill" style={{ color: "var(--text-4)" }}>前月</span>
                <div className="catbr-track"><i style={{ width: `${(s.prev / max) * 100}%`, background: "var(--bg-3)" }} /></div>
                <span className="catbr-val mono" style={{ color: "var(--text-3)" }}>¥{s.prev.toLocaleString("ja-JP")}</span>
              </div>
            </div>
            <div className={"catbr-delta " + (delta > 0 ? "up" : "down")}>
              <Icon name={delta > 0 ? "arrow-up-r" : "arrow-dn-r"} size={12} />
              {delta > 0 ? "+" : "−"}{Math.abs(deltaPct)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DonutBreakdown() {
  const total = CAT_STATS.reduce((s, c) => s + c.spent, 0);
  const sorted = [...CAT_STATS].sort((a, b) => b.spent - a.spent);
  // Build donut segments
  const size = 160, stroke = 22, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div>
      <div style={{ display: "grid", placeItems: "center", padding: "8px 0 14px", position: "relative" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          {sorted.map((s, i) => {
            const frac = s.spent / total;
            const seg = (
              <circle
                key={i}
                cx={size/2} cy={size/2} r={r}
                fill="none"
                stroke={CATEGORIES[s.cat].color}
                strokeWidth={stroke}
                strokeDasharray={`${c * frac - 2} ${c - (c * frac - 2)}`}
                strokeDashoffset={-acc * c}
              />
            );
            acc += frac;
            return seg;
          })}
        </svg>
        <div style={{ position: "absolute", textAlign: "center", lineHeight: 1.1 }}>
          <div className="mono" style={{ fontSize: 22, fontWeight: 600 }}>¥{(total / 1000).toFixed(0)}k</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>支出合計</div>
        </div>
      </div>
      {sorted.map((s, i) => {
        const cc = CATEGORIES[s.cat];
        const pct = (s.spent / total) * 100;
        return (
          <div className="donut-legend-row" key={i}>
            <span className="dot-sq" style={{ background: cc.color }} />
            <span style={{ flex: 1, fontSize: 13 }}>{cc.label}</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>{pct.toFixed(1)}%</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--text-3)", width: 72, textAlign: "right" }}>¥{s.spent.toLocaleString("ja-JP")}</span>
          </div>
        );
      })}
    </div>
  );
}

function WeekdayHeatmap() {
  const DAYS = ["月","火","水","木","金","土","日"];
  const HOURS = ["朝","昼","夕","夜","深"];
  // Synthetic matrix, values 0-100
  const M = [
    [10, 40, 25, 50, 8],
    [15, 55, 30, 45, 5],
    [8,  38, 20, 42, 6],
    [12, 50, 28, 55, 9],
    [20, 65, 42, 88, 32],
    [30, 72, 60, 92, 45],
    [22, 48, 40, 65, 18],
  ];
  return (
    <div className="heat-wrap">
      <div className="heat-corner"></div>
      {HOURS.map((h, i) => <div className="heat-col-h" key={i}>{h}</div>)}
      {DAYS.map((d, i) => (
        <React.Fragment key={i}>
          <div className="heat-row-h">{d}</div>
          {M[i].map((v, j) => (
            <div
              key={j}
              className="heat-cell"
              style={{ background: `color-mix(in oklch, var(--accent) ${v}%, var(--bg-2))` }}
              title={`${d} ${HOURS[j]} — 強度 ${v}`}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function TopTransactions() {
  const top = [...TRANSACTIONS]
    .sort((a, b) => Math.abs(b.amt) - Math.abs(a.amt))
    .slice(0, 5);
  const max = Math.abs(top[0].amt);
  return (
    <div>
      {top.map((t, i) => {
        const c = CATEGORIES[t.cat];
        return (
          <div key={t.id} className="top-row">
            <div className="top-rank mono">{i + 1}</div>
            <CategoryIcon cat={t.cat} size={30} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tx-name">{t.name}</div>
              <div className="tx-meta">{c.label} · {t.date.slice(5)}</div>
              <div className="top-bar">
                <i style={{ width: `${(Math.abs(t.amt) / max) * 100}%`, background: c.color }} />
              </div>
            </div>
            <div className="mono" style={{ fontWeight: 600 }}>−¥{Math.abs(t.amt).toLocaleString("ja-JP")}</div>
          </div>
        );
      })}
    </div>
  );
}

function InsightCard({ tone = "info", icon, title, body, metric }) {
  const toneMap = {
    warn: { bg: "var(--warn-soft)",  fg: "var(--warn)" },
    pos:  { bg: "var(--pos-soft)",   fg: "var(--pos)" },
    info: { bg: "var(--info-soft)",  fg: "var(--info)" },
    neg:  { bg: "var(--neg-soft)",   fg: "var(--neg)" },
  };
  const tt = toneMap[tone];
  return (
    <div className="insight-card">
      <div className="insight-icon" style={{ background: tt.bg, color: tt.fg }}>
        <Icon name={icon} size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="insight-title">{title}</div>
        <div className="insight-body">{body}</div>
      </div>
      <div className="insight-metric mono" style={{ color: tt.fg }}>{metric}</div>
    </div>
  );
}

window.AnalysisPage = AnalysisPage;
