/**
 * Typed API Client
 * Centralized fetch wrapper with error handling, typing, and demo/local mode support
 */

import { MODE, MODE_LABEL } from '../config/mode.js';
import { getEndpointUrl, ENDPOINTS } from '../config/endpoints.js';
import {
  type CompileRequest,
  type CompileResponse,
  type CompileErrorResponse,
  type PaymentRequest,
  type RefundRequest,
  type ScenarioStep,
  type ApiErrorResponse,
} from '../types/api.js';

/** API Error class */
export class ApiError extends Error {
  public readonly status: number;
  public readonly endpoint: string;
  public readonly originalError?: Error;

  constructor(message: string, status: number, endpoint: string, originalError?: Error) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.originalError = originalError;
  }
}

/** Request options */
type RequestOptions = RequestInit & {
  /** Timeout in milliseconds */
  timeout?: number;
};

/** Default request timeout */
const DEFAULT_TIMEOUT = 30_000;

/**
 * Typed fetch with timeout and error handling
 */
async function fetchWithTimeout<T>(
  url: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: unknown;
    if (isJson) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage =
        typeof data === 'object' && data !== null && 'error' in data
          ? (data as ApiErrorResponse).error
          : `HTTP ${response.status}: ${response.statusText}`;

      throw new ApiError(errorMessage, response.status, url);
    }

    return data as T;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Request timeout', 408, url, error);
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new ApiError(
        `Network error — is the backend running at ${MODE.apiBase}?`,
        0,
        url,
        error
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown error',
      0,
      url,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * API Client Methods
 */
export const apiClient = {
  /**
   * Compile natural language prompt to rulebook
   * POST /qa/compile
   */
  async compileScenario(prompt: string): Promise<CompileResponse> {
    if (MODE.isDemo) {
      throw new ApiError('Compile not available in demo mode', 400, ENDPOINTS.compile);
    }

    return fetchWithTimeout<CompileResponse>(getEndpointUrl('compile'), {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  },

  /**
   * Process payment
   * POST /payment
   */
  async processPayment(request: PaymentRequest): Promise<{ message: string } | ApiErrorResponse> {
    if (MODE.isDemo) {
      throw new ApiError('Payment not available in demo mode', 400, ENDPOINTS.payment);
    }

    return fetchWithTimeout(getEndpointUrl('payment'), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Process refund
   * POST /refund
   */
  async processRefund(request: RefundRequest): Promise<{ message: string } | ApiErrorResponse> {
    if (MODE.isDemo) {
      throw new ApiError('Refund not available in demo mode', 400, ENDPOINTS.refund);
    }

    return fetchWithTimeout(getEndpointUrl('refund'), {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string }> {
    if (MODE.isDemo) {
      return { status: 'demo-mode' };
    }

    return fetchWithTimeout(getEndpointUrl('health'), {
      method: 'GET',
    });
  },
};

/**
 * Batch execution helper for firing cannon
 * Executes multiple requests concurrently with idempotency key strategy
 */
export interface BatchRequestConfig {
  endpoint: 'payment' | 'refund';
  count: number;
  baseRequest: PaymentRequest | RefundRequest;
  strategy: 'unique' | 'shared';
  onProgress?: (result: { status: number; message: string; index: number }) => void;
}

export interface BatchResult {
  results: Array<{ status: number; message: string; index: number }>;
  metrics: {
    total: number;
    ok200: number;
    conflict409: number;
    error500: number;
    refunds: number;
  };
}

/**
 * Execute a batch of requests concurrently
 */
export async function executeBatch(config: BatchRequestConfig): Promise<BatchResult> {
  const { endpoint, count, baseRequest, strategy, onProgress } = config;

  const results: Array<{ status: number; message: string; index: number }> = [];
  const metrics = {
    total: 0,
    ok200: 0,
    conflict409: 0,
    error500: 0,
    refunds: 0,
  };

  const requests: Promise<{ status: number; message: string; index: number }>[] = [];

  for (let i = 0; i < count; i++) {
    const idempotencyKey =
      strategy === 'shared'
        ? baseRequest.idempotencyKey
        : crypto.randomUUID();

    const request = {
      ...baseRequest,
      idempotencyKey,
    };

    const promise = (async (index: number) => {
      try {
        let response: { message: string } | ApiErrorResponse;
        if (endpoint === 'payment') {
          response = await apiClient.processPayment(request as PaymentRequest);
        } else {
          response = await apiClient.processRefund(request as RefundRequest);
        }

        const status = 'error' in response ? 409 : 200; // Simplified - real status from fetch
        const message = 'error' in response ? response.error : response.message;

        // Update metrics
        metrics.total++;
        if (status === 200) {
          metrics.ok200++;
          if (endpoint === 'refund') metrics.refunds++;
        } else if (status === 409) {
          metrics.conflict409++;
        } else if (status >= 500) {
          metrics.error500++;
        }

        const result = { status, message, index };
        onProgress?.(result);
        return result;
      } catch (error) {
        const apiError = error as ApiError;
        metrics.total++;
        metrics.error500++;

        const result = {
          status: apiError.status || 500,
          message: apiError.message,
          index,
        };
        onProgress?.(result);
        return result;
      }
    })(i);

    requests.push(promise);
  }

  const settled = await Promise.allSettled(requests);

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      results.push({
        status: 500,
        message: result.reason?.message || 'Unknown error',
        index: -1,
      });
    }
  }

  return { results, metrics };
}

/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}