// Shared dummy data + helpers
const CATEGORIES = {
  food:    { label: "食費",     icon: "coffee",   color: "var(--cat-food)" },
  daily:   { label: "日用品",   icon: "shopping", color: "var(--cat-daily)" },
  transit: { label: "交通費",   icon: "bus",      color: "var(--cat-transit)" },
  fixed:   { label: "固定費",   icon: "home",     color: "var(--cat-fixed)" },
  leisure: { label: "娯楽",     icon: "film",     color: "var(--cat-leisure)" },
  other:   { label: "その他支出", icon: "tag",    color: "var(--cat-other)" },
};

const PAYMENTS = {
  cash:    { label: "現金",         icon: "cash" },
  credit:  { label: "クレジットカード", icon: "card" },
  bank:    { label: "銀行口座",     icon: "bank" },
};

// Recent transactions — Apr 2026, fits "today is Apr 19, 2026"
const TRANSACTIONS = [
  { id: 1,  date: "2026-04-19", time: "09:12", name: "コンビニコーヒー",     cat: "food",    pay: "cash",   memo: "出社前", amt: -180 },
  { id: 2,  date: "2026-04-19", time: "08:30", name: "Suica チャージ",        cat: "transit", pay: "credit", memo: "",      amt: -3000 },
  { id: 3,  date: "2026-04-18", time: "20:42", name: "スーパー まいばすけっと", cat: "food",    pay: "cash",   memo: "夕食材料", amt: -1840 },
  { id: 4,  date: "2026-04-18", time: "12:15", name: "ランチ",                cat: "food",    pay: "credit", memo: "",      amt: -980 },
  { id: 5,  date: "2026-04-17", time: "21:30", name: "Netflix",               cat: "leisure", pay: "credit", memo: "月額",   amt: -1490 },
  { id: 6,  date: "2026-04-17", time: "13:00", name: "ドラッグストア",          cat: "daily",   pay: "cash",   memo: "シャンプー他", amt: -2380 },
  { id: 7,  date: "2026-04-16", time: "19:20", name: "居酒屋 やまと",         cat: "leisure", pay: "credit", memo: "同期と",  amt: -4200 },
  { id: 8,  date: "2026-04-15", time: "16:04", name: "コンビニ",              cat: "food",    pay: "cash",   memo: "",      amt: -1000 },
  { id: 9,  date: "2026-04-15", time: "15:59", name: "Amazon",                cat: "other",   pay: "credit", memo: "uouo",  amt: -20000 },
  { id: 10, date: "2026-04-12", time: "00:00", name: "定期実行3月24日…",      cat: "daily",   pay: "cash",   memo: "テストだよ", amt: -1000 },
  { id: 11, date: "2026-04-11", time: "00:00", name: "定期実行3月24日…",      cat: "daily",   pay: "cash",   memo: "テストだよ", amt: -1000 },
  { id: 12, date: "2026-04-10", time: "00:00", name: "定期実行3月24日…",      cat: "daily",   pay: "cash",   memo: "テストだよ", amt: -1000 },
  { id: 13, date: "2026-04-09", time: "07:00", name: "電車定期",              cat: "transit", pay: "credit", memo: "",      amt: -12500 },
  { id: 14, date: "2026-04-08", time: "12:30", name: "ラーメン まこと",        cat: "food",    pay: "cash",   memo: "",      amt: -980 },
  { id: 15, date: "2026-04-07", time: "20:10", name: "コンビニ",              cat: "food",    pay: "cash",   memo: "",      amt: -540 },
  { id: 16, date: "2026-04-05", time: "10:00", name: "家賃",                 cat: "fixed",   pay: "bank",   memo: "4月分",   amt: -82000 },
  { id: 17, date: "2026-04-05", time: "10:00", name: "電気代",               cat: "fixed",   pay: "bank",   memo: "",       amt: -6800 },
];

const QUICK_ITEMS = [
  { name: "コンビニコーヒー",  cat: "food",    pay: "cash",   amt: 180 },
  { name: "ランチ",           cat: "food",    pay: "cash",   amt: 980 },
  { name: "Suica チャージ",   cat: "transit", pay: "credit", amt: 3000 },
  { name: "スーパー",         cat: "food",    pay: "cash",   amt: 2000 },
];

const BUDGETS = [
  { cat: "food",    budget: 50000, spent: 7500 },
  { cat: "daily",   budget: 20000, spent: 18000 },
  { cat: "transit", budget: 20000, spent: 15500 },
  { cat: "leisure", budget: 15000, spent: 5690 },
  { cat: "fixed",   budget: 95000, spent: 88800 },
  { cat: "other",   budget: 30000, spent: 20000 },
];

const SAVINGS_GOALS = [
  { id: 1, name: "ヨーロッパ旅行",   icon: "plane",  current: 180000, target: 600000, due: "2026-12-31",  color: "oklch(0.74 0.13 240)" },
  { id: 2, name: "新しい時計",      icon: "watch",  current: 9000,   target: 60000,  due: "2026-05-31",  color: "oklch(0.74 0.13 25)" },
  { id: 3, name: "カメラ",         icon: "camera", current: 42000,  target: 120000, due: "2026-09-30",  color: "oklch(0.74 0.13 320)" },
  { id: 4, name: "緊急予備費",      icon: "piggy",  current: 300000, target: 300000, due: null,           color: "oklch(0.74 0.14 155)", done: true },
];

const ACCOUNTS = [
  { id: 1, label: "現金財布",        icon: "cash", balance: -2157,   sub: "今月-1,200" },
  { id: 2, label: "三井住友VISA",    icon: "card", balance: -32400,  sub: "請求 4/27" },
  { id: 3, label: "メイン口座",      icon: "bank", balance: 432580,  sub: "給与振込" },
  { id: 4, label: "貯蓄用",         icon: "piggy",balance: 530000,  sub: "目標進捗" },
];

const yen = (n) => {
  const sign = n < 0 ? "-" : "";
  return sign + "¥" + Math.abs(n).toLocaleString("ja-JP");
};
const yenPlain = (n) => "¥" + Math.abs(n).toLocaleString("ja-JP");

// 30 days of spending — used by sparkline & monthly trend
const DAILY_SPEND = [
  3200, 1800, 0, 4500, 2100, 8200, 3400,
  1200, 0, 2800, 4100, 6800, 2500, 1500,
  3300, 22500, 2900, 1200, 4800, 7200, 0,
  3100, 1800, 5400, 8900, 2300, 1500, 4200,
  3600, 0,
];

window.CATEGORIES = CATEGORIES;
window.PAYMENTS = PAYMENTS;
window.TRANSACTIONS = TRANSACTIONS;
window.QUICK_ITEMS = QUICK_ITEMS;
window.BUDGETS = BUDGETS;
window.SAVINGS_GOALS = SAVINGS_GOALS;
window.ACCOUNTS = ACCOUNTS;
window.DAILY_SPEND = DAILY_SPEND;
window.yen = yen;
window.yenPlain = yenPlain;
