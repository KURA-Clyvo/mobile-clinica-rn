import { queryClient, persistOptions, asyncStoragePersister } from '../src/services/queryClient';

describe('queryClient', () => {
  it('is a singleton (same reference on multiple imports)', async () => {
    const { queryClient: qc2 } = await import('../src/services/queryClient');
    expect(queryClient).toBe(qc2);
  });

  it('has correct staleTime default (60s)', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(60_000);
  });

  it('has correct gcTime default (5 min)', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.gcTime).toBe(5 * 60 * 1000);
  });

  it('retry is 2', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.retry).toBe(2);
  });

  it('refetchOnWindowFocus is false', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false);
  });

  it('refetchOnReconnect is true', () => {
    const defaults = queryClient.getDefaultOptions();
    expect(defaults.queries?.refetchOnReconnect).toBe(true);
  });

  it('retryDelay exponential backoff does not exceed 10s', () => {
    const retryDelay = queryClient.getDefaultOptions().queries?.retryDelay;
    if (typeof retryDelay !== 'function') return;
    expect(retryDelay(0, new Error())).toBe(1000);
    expect(retryDelay(1, new Error())).toBe(2000);
    expect(retryDelay(2, new Error())).toBe(4000);
    expect(retryDelay(3, new Error())).toBe(8000);
    expect(retryDelay(10, new Error())).toBe(10_000);
  });

  it('persistOptions has maxAge of 24h', () => {
    expect(persistOptions.maxAge).toBe(24 * 60 * 60 * 1000);
  });

  it('persister is configured with asyncStoragePersister', () => {
    expect(persistOptions.persister).toBe(asyncStoragePersister);
  });

  it('asyncStoragePersister is defined', () => {
    expect(asyncStoragePersister).toBeDefined();
  });
});
