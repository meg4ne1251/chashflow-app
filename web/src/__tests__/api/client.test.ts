/**
 * apiClient のレスポンスインターセプタ（401自動リフレッシュ・キューイング・ログイン誘導）のテスト。
 *
 * 実 HTTP は発生させず、axios の adapter を差し替えてレスポンスを制御する。
 * client.ts はモジュールレベルに refresh 状態 (isRefreshing / refreshFailCount) を持つため、
 * 各テストで vi.resetModules() し、同じ axios インスタンスを共有した状態で読み直す。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

type RouteResult = { status: number; data?: unknown };
type RequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };
type RouteFn = (config: RequestConfig) => RouteResult;

let apiClient: AxiosInstance;
// 当該テストで import し直した axios の AxiosError を使う（client 側の instanceof と一致させる）
let AxiosErrorCtor: new (...args: unknown[]) => Error;
let route: RouteFn;
const calls: Array<{ method?: string; url?: string }> = [];

// インターセプタが発行するリフレッシュは POST /auth/refresh。
// 元リクエスト自身が /auth/refresh への GET であるケースと区別する。
const refreshCalls = () =>
  calls.filter((c) => c.method === 'post' && c.url?.includes('/auth/refresh'));

const adapter = async (config: RequestConfig) => {
  calls.push({ method: config.method, url: config.url });
  const r = route(config);
  const response = { data: r.data ?? {}, status: r.status, statusText: '', headers: {}, config };
  if (r.status === 0) {
    // ネットワークエラー（error.response が無いケース）
    throw new AxiosErrorCtor('Network Error', 'ERR_NETWORK', config);
  }
  if (r.status >= 400) {
    throw new AxiosErrorCtor('Request failed', String(r.status), config, {}, response);
  }
  return response;
};

beforeEach(async () => {
  vi.resetModules();
  calls.length = 0;
  route = () => ({ status: 200, data: {} });

  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { href: '' },
  });

  const axiosMod = await import('axios');
  AxiosErrorCtor = axiosMod.AxiosError as unknown as new (...args: unknown[]) => Error;
  const clientMod = await import('@/api/client');
  apiClient = clientMod.default;

  // client.ts が使う global axios と apiClient の両方に adapter を差し込む
  axiosMod.default.defaults.adapter = adapter;
  apiClient.defaults.adapter = adapter;
});

describe('apiClient response interceptor', () => {
  it('passes successful responses through unchanged', async () => {
    route = () => ({ status: 200, data: { ok: true } });
    const res = await apiClient.get('/transactions');
    expect(res.data).toEqual({ ok: true });
    expect(refreshCalls()).toHaveLength(0);
  });

  it('refreshes once and retries the original request on 401', async () => {
    let protectedHits = 0;
    route = (config) => {
      if (config.url?.includes('/auth/refresh')) return { status: 200 };
      protectedHits += 1;
      return protectedHits === 1 ? { status: 401 } : { status: 200, data: { ok: true } };
    };

    const res = await apiClient.get('/transactions');

    expect(res.data).toEqual({ ok: true });
    expect(refreshCalls()).toHaveLength(1);
    expect(refreshCalls()[0].method).toBe('post');
  });

  it.each(['/auth/refresh', '/auth/login', '/auth/me'])(
    'does not attempt refresh when %s itself returns 401',
    async (url) => {
      route = () => ({ status: 401 });

      await expect(apiClient.get(url)).rejects.toMatchObject({
        response: { status: 401 },
      });
      expect(refreshCalls()).toHaveLength(0);
    },
  );

  it('redirects to /login when the refresh call returns 401', async () => {
    route = (config) => {
      // 元リクエストも refresh も 401
      return config.url?.includes('/auth/refresh') ? { status: 401 } : { status: 401 };
    };

    await expect(apiClient.get('/transactions')).rejects.toBeTruthy();
    expect(window.location.href).toBe('/login');
  });

  it('rejects non-401 errors without refreshing', async () => {
    route = () => ({ status: 500, data: { error: { code: 'INTERNAL' } } });

    await expect(apiClient.get('/transactions')).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(refreshCalls()).toHaveLength(0);
  });

  it('rejects network errors (no response) without refreshing', async () => {
    route = () => ({ status: 0 });

    await expect(apiClient.get('/transactions')).rejects.toBeTruthy();
    expect(refreshCalls()).toHaveLength(0);
  });

  it('queues concurrent 401s and refreshes only once', async () => {
    const hits: Record<string, number> = {};
    route = (config) => {
      if (config.url?.includes('/auth/refresh')) return { status: 200 };
      const url = config.url ?? '';
      hits[url] = (hits[url] ?? 0) + 1;
      return hits[url] === 1 ? { status: 401 } : { status: 200, data: { url } };
    };

    const [a, b] = await Promise.all([
      apiClient.get('/transactions'),
      apiClient.get('/budgets'),
    ]);

    expect(a.data).toEqual({ url: '/transactions' });
    expect(b.data).toEqual({ url: '/budgets' });
    // 並行401でもリフレッシュは1回だけ
    expect(refreshCalls()).toHaveLength(1);
  });
});
