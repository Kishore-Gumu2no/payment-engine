/**
 * API Endpoints Configuration
 * Centralized endpoint definitions matching backend contracts
 */

import { MODE } from './mode.js';

/** Build full API URL */
function buildUrl(path: string): string {
  return `${MODE.apiBase}${path}`;
}

/** API Endpoints */
export const ENDPOINTS = {
  /** Compile natural language prompt to rulebook */
  compile: '/qa/compile',

  /** Process payment */
  payment: '/payment',

  /** Process refund */
  refund: '/refund',

  /** Health check (if available) */
  health: '/health',
} as const;

/** Get full URL for an endpoint */
export function getEndpointUrl(endpoint: keyof typeof ENDPOINTS): string {
  return buildUrl(ENDPOINTS[endpoint]);
}

/** Request/Response type mapping for endpoints */
export interface EndpointMap {
  '/qa/compile': {
    request: { prompt: string };
    response: { message: string; rulebook: import('../types/api.js').ScenarioStep[] };
  };
  '/payment': {
    request: { amount: number; idempotencyKey: string };
    response: { message: string } | { error: string };
  };
  '/refund': {
    request: { originalTransactionId: string; idempotencyKey: string };
    response: { message: string } | { error: string };
  };
}