/**
 * API Request/Response Types
 * Derived from backend contracts in server.ts and ai-compiler.ts
 */

/** Payment Request */
export interface PaymentRequest {
  amount: number;
  idempotencyKey: string;
}

/** Payment Response (success) */
export interface PaymentSuccessResponse {
  message: string;
}

/** Payment/Refund Error Response */
export interface ApiErrorResponse {
  error: string;
}

/** Refund Request */
export interface RefundRequest {
  originalTransactionId: string;
  idempotencyKey: string;
}

/** Refund Response (success) */
export interface RefundSuccessResponse {
  message: string;
}

/** Mock Response from AI Compiler */
export interface MockResponse {
  httpStatus: number;
  body: {
    message: string;
  };
}

/** Payment Step from AI Compiler */
export interface PaymentStep {
  stepId: string;
  action: 'PAYMENT';
  amount: number;
  requestVolume: number;
  executionStrategy: 'Sequential' | 'Concurrent Attack';
  mockResponse: MockResponse;
}

/** Refund Step from AI Compiler */
export interface RefundStep {
  stepId: string;
  action: 'REFUND';
  originalTransactionId: string;
  requestVolume: number;
  executionStrategy: 'Sequential' | 'Concurrent Attack';
  mockResponse: MockResponse;
}

/** Union of all step types */
export type ScenarioStep = PaymentStep | RefundStep;

/** Compile Request */
export interface CompileRequest {
  prompt: string;
}

/** Compile Response */
export interface CompileResponse {
  message: string;
  rulebook: ScenarioStep[];
}

/** Compile Error Response */
export interface CompileErrorResponse {
  error: string;
}

/** Sync Scenario Request (manual builder) */
export interface SyncScenarioRequest {
  requestVolume: number;
  actionType: 'PAYMENT' | 'REFUND';
  expectedOutcome: '200_SUCCESS' | '500_INTERNAL_ERROR' | 'TIMEOUT';
  executionStrategy: 'Sequential (Unique Keys)' | 'Concurrent Attack (Same Key)';
  mockResponse: MockResponse;
}

/** Generic API Response Wrapper */
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}