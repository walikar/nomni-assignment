export interface UberClient {
  /** GET /v2/eats/order/{order_id} — the webhook only says *that* something changed. */
  getOrder(orderId: string): Promise<unknown>;
}

export class UpstreamError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function createUberClient(opts: {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): UberClient {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async getOrder(orderId) {
      const url = `${opts.baseUrl.replace(/\/$/, '')}/v2/eats/order/${encodeURIComponent(orderId)}`;
      let res: Response;
      try {
        res = await doFetch(url, {
          headers: { Authorization: `Bearer ${opts.accessToken}`, Accept: 'application/json' },
          signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
        });
      } catch (err) {
        throw new UpstreamError(`Uber Get Order request failed: ${(err as Error).message}`);
      }
      if (!res.ok) throw new UpstreamError(`Uber Get Order returned ${res.status}`, res.status);
      return res.json();
    },
  };
}
