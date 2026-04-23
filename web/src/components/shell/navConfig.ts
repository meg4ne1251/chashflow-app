import type { IconName } from '@/components/Icon';

export interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  badge?: string;
}

/** Primary navigation items shown at the top of the sidebar */
export const NAV_MAIN: NavItem[] = [
  { path: '/dashboard', label: 'ダッシュボード', icon: 'dashboard' },
  { path: '/transactions', label: '取引一覧', icon: 'list' },
  { path: '/transfers', label: '振替', icon: 'swap' },
];

/** Master data management items */
export const NAV_MASTER: NavItem[] = [
  { path: '/categories', label: 'カテゴリ', icon: 'tag' },
  { path: '/accounts', label: '決済手段', icon: 'card' },
  { path: '/tags', label: 'タグ', icon: 'folder' },
  { path: '/templates', label: 'テンプレート', icon: 'bookmark' },
  { path: '/recurring', label: '定期取引', icon: 'repeat' },
];

/** Analysis section */
export const NAV_ANALYSIS: NavItem[] = [
  { path: '/analysis', label: '分析', icon: 'chart' },
  { path: '/budgets', label: '予算', icon: 'wallet' },
  { path: '/savings-goals', label: '貯蓄目標', icon: 'piggy' },
];

/** Settings section */
export const NAV_SETTINGS: NavItem[] = [
  { path: '/settings', label: '設定', icon: 'settings' },
];

/** Page metadata for breadcrumb / page titles */
export interface PageMeta {
  title: string;
  sub?: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  '/dashboard': { title: 'ダッシュボード' },
  '/transactions': { title: '取引一覧' },
  '/transactions/new': { title: '新規取引' },
  '/transfers': { title: '振替' },
  '/categories': { title: 'カテゴリ', sub: 'マスタ' },
  '/accounts': { title: '決済手段', sub: 'マスタ' },
  '/tags': { title: 'タグ', sub: 'マスタ' },
  '/templates': { title: 'テンプレート', sub: 'マスタ' },
  '/recurring': { title: '定期取引', sub: 'マスタ' },
  '/analysis': { title: '分析' },
  '/budgets': { title: '予算' },
  '/savings-goals': { title: '貯蓄目標' },
  '/settings': { title: '設定' },
  '/notifications': { title: '通知履歴' },
  '/more': { title: 'メニュー' },
};

export function resolvePageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  if (pathname.match(/^\/transactions\/[^/]+\/edit$/)) return { title: '取引の編集' };
  return { title: '家計簿' };
}
