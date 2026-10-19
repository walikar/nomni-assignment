import axios from 'axios';
import { DemoResult, Order, OrdersPage, OrderStatus, Provider } from './types';

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// An error from the API, with the HTTP status and the response body
// (e.g. { error: 'status_changed', current: 'accepted' }).
export class ApiError extends Error {
  status: number;
  body: Record<string, any>;

  constructor(message: string, status: number, body: Record<string, any> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// One axios instance for every call to our API.
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Turn every failed request into an ApiError, so pages only deal with one error type.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A cancelled request (we started a newer one) is passed through untouched.
    if (axios.isCancel(error)) return Promise.reject(error);

    // The API answered with an error status (4xx / 5xx).
    if (error.response) {
      const { status, data } = error.response;
      return Promise.reject(new ApiError(data?.error || `Request failed (${status})`, status, data));
    }

    // No answer at all: the API is down or unreachable.
    return Promise.reject(new ApiError(`Can't reach the API at ${BASE_URL}. Is it running?`, 0));
  },
);

// True when a request was cancelled on purpose (the page started a newer one).
export function isRequestCancelled(error: unknown): boolean {
  return axios.isCancel(error);
}

// params looks like { provider: 'doordash', sort: '-total' }
export async function fetchOrders(params: Record<string, string>, signal?: AbortSignal): Promise<OrdersPage> {
  const response = await api.get<OrdersPage>('/api/orders', { params, signal });
  return response.data;
}

export async function fetchOrderById(id: string, signal?: AbortSignal): Promise<Order> {
  const response = await api.get<Order>(`/api/orders/${encodeURIComponent(id)}`, { signal });
  return response.data;
}

// Moves an order one step forward. `currentStatus` is the status the page is showing;
// if someone else already moved the order, the API answers 409 status_changed.
export async function moveOrderForward(id: string, currentStatus: OrderStatus): Promise<Order> {
  const response = await api.post<Order>(`/api/orders/${encodeURIComponent(id)}/advance`, { from: currentStatus });
  return response.data;
}

export async function fetchDemoEnabled(): Promise<boolean> {
  try {
    const response = await api.get<{ enabled: boolean }>('/api/demo');
    return Boolean(response.data.enabled);
  } catch {
    return false;
  }
}

// Asks the API to send a real provider webhook to itself, once or twice at the same time.
export async function sendDemoOrder(provider: Provider, times: 1 | 2): Promise<DemoResult> {
  const response = await api.post<DemoResult>('/api/demo/orders', { provider, times });
  return response.data;
}
