/**
 * packages/shared/src/client.ts
 *
 * Typed API Client for ONEiD (README §14, §17).
 * Connects web frontend and portals to the Fastify backend.
 */

import type {
  CreateClaimRequestBody,
  ConsentDecisionBody,
  VerifyPresentationBody,
  CreateCorrectionBody,
  RespondCorrectionBody,
  SimulateFailureBody,
} from "./index.js";

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    retryable?: boolean;
  };
  statusCode: number;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(code: string, message: string, statusCode: number, retryable = false) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export interface ClientOptions {
  baseUrl?: string | undefined;
  fetchFn?: typeof fetch | undefined;
}

export class OneIdClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: ClientOptions = {}) {
    const isBrowser = typeof globalThis !== "undefined" && "window" in globalThis;
    this.baseUrl = options.baseUrl ?? (isBrowser ? "" : "http://localhost:4000");
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(init?.headers);
    if (!headers.has("Content-Type") && init?.body) {
      headers.set("Content-Type", "application/json");
    }

    const response = await this.fetchFn(url, {
      ...init,
      headers,
      credentials: "include", // send session cookie
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const err = body?.error ?? {};
      throw new ApiError(
        err.code ?? "UNKNOWN_ERROR",
        err.message ?? `HTTP error ${response.status}`,
        response.status,
        Boolean(err.retryable),
      );
    }

    return body as T;
  }

  // ── Auth & Session ────────────────────────────────────────────────────────
  public readonly auth = {
    loginPortal: (payload: { role: string; demoKey: string; stellarAddress?: string }) =>
      this.request<{ status: string; role: string; userId: string }>(
        "/v1/auth/portal/login",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    getMe: () =>
      this.request<{
        authenticated: boolean;
        user?: { id: string; role: string; stellarAddress?: string };
      }>("/v1/auth/me"),
    logout: () =>
      this.request<{ status: string }>("/v1/auth/logout", {
        method: "POST",
      }),
  };

  // ── Claim Requests ────────────────────────────────────────────────────────
  public readonly requests = {
    create: (data: CreateClaimRequestBody) =>
      this.request<{ id: string; nonce: string; status: string }>("/v1/requests", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getPending: () =>
      this.request<{ requests: Array<Record<string, unknown>> }>("/v1/requests/pending"),
    getById: (id: string) => this.request<Record<string, unknown>>(`/v1/requests/${id}`),
  };

  // ── Consent Receipts ──────────────────────────────────────────────────────
  public readonly consents = {
    create: (data: ConsentDecisionBody) =>
      this.request<{
        id: string;
        receiptHash: string;
        chainTx?: string | null;
        ledger?: number | null;
        approvedClaims: string[];
      }>("/v1/consents", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    withdraw: (receiptHash: string) =>
      this.request<{ receiptHash: string; status: string; notice: string }>(
        `/v1/consents/${receiptHash}/withdraw`,
        { method: "POST" },
      ),
    list: () =>
      this.request<{ consents: Array<Record<string, unknown>> }>("/v1/consents"),
  };

  // ── Verification ──────────────────────────────────────────────────────────
  public readonly verification = {
    verifyPresentation: (data: VerifyPresentationBody) =>
      this.request<{
        verified: boolean;
        code: string;
        claims?: Record<string, unknown>;
        holder?: string;
        issuer?: string;
        reason?: string;
      }>("/v1/verify/presentation", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getCredentialStatus: (credentialHash: string) =>
      this.request<{
        id: string;
        credentialHash: string;
        status: "active" | "revoked" | "expired";
        expiresAt: string;
      }>(`/v1/verify/credential/${credentialHash}/status`),
  };

  // ── Corrections ───────────────────────────────────────────────────────────
  public readonly corrections = {
    create: (data: CreateCorrectionBody) =>
      this.request<{
        id: string;
        ticketHash: string;
        category: string;
        outcomes: Array<{ institutionId: string; status: string }>;
      }>("/v1/corrections", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getById: (id: string) =>
      this.request<{
        id: string;
        ticketHash: string;
        category: string;
        detail: Record<string, unknown>;
        outcomes: Array<{
          institutionId: string;
          institutionName?: string;
          status: string;
          reasonCode?: string | number;
        }>;
      }>(`/v1/corrections/${id}`),
    getQueue: () =>
      this.request<{ queue: Array<Record<string, unknown>> }>("/v1/corrections/queue"),
    respond: (id: string, data: RespondCorrectionBody) =>
      this.request<{
        outcomeId: string;
        ticketId: string;
        status: string;
        reasonCode?: number;
      }>(`/v1/corrections/${id}/respond`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  };

  // ── Identity & Applications ───────────────────────────────────────────────
  public readonly identity = {
    verifyMockNin: (data: { nin: string }) =>
      this.request<{ valid: boolean; profile?: Record<string, unknown> }>(
        "/v1/identity/mock-nin/verify",
        { method: "POST", body: JSON.stringify(data) },
      ),
    simulateFaceCheck: (data?: { imageRef?: string }) =>
      this.request<{ matched: boolean; score: number }>(
        "/v1/identity/face-check/simulate",
        { method: "POST", body: JSON.stringify(data ?? {}) },
      ),
    createApplication: (data: { issuerId: string }) =>
      this.request<{ id: string; status: string }>("/v1/applications", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getApplications: () =>
      this.request<{ applications: Array<Record<string, unknown>> }>("/v1/applications"),
    decideApplication: (
      id: string,
      data: { decision: "approved" | "rejected"; note?: string },
    ) =>
      this.request<{ id: string; status: string }>(`/v1/applications/${id}/decision`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getCredentials: () =>
      this.request<{ credentials: Array<Record<string, unknown>> }>("/v1/credentials"),
  };

  // ── Issuance ──────────────────────────────────────────────────────────────
  public readonly issuance = {
    issue: (data: {
      applicationId?: string;
      holderUserId: string;
      claims: string[];
      validityDays?: number;
    }) =>
      this.request<{
        id: string;
        credentialHash: string;
        sdJwt: string;
        expiresAt: string;
      }>("/v1/credentials/issue", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    revoke: (hash: string, data?: { reasonCode?: number }) =>
      this.request<{ hash: string; status: string }>(`/v1/credentials/${hash}/revoke`, {
        method: "POST",
        body: JSON.stringify(data ?? {}),
      }),
  };

  // ── Registry ──────────────────────────────────────────────────────────────
  public readonly registry = {
    getEntities: () =>
      this.request<{
        entities: Array<{
          id: string;
          name: string;
          role: string;
          stellarAddress: string;
          status: string;
          homeDomain: string;
        }>;
      }>("/v1/registry/entities"),
    registerEntity: (data: {
      stellarAddress: string;
      role: "issuer" | "verifier";
      name: string;
      homeDomain: string;
    }) =>
      this.request<Record<string, unknown>>("/v1/registry/entities", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateEntityStatus: (
      addr: string,
      data: { status: "active" | "suspended" | "removed" },
    ) =>
      this.request<Record<string, unknown>>(`/v1/registry/entities/${addr}/status`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  };

  // ── Audit ─────────────────────────────────────────────────────────────────
  public readonly audit = {
    getTimeline: () =>
      this.request<{ events: Array<Record<string, unknown>> }>("/v1/audit/timeline"),
    getEvents: () =>
      this.request<{
        events: Array<Record<string, unknown>>;
        integrity: { valid: boolean };
      }>("/v1/audit/events"),
  };

  // ── Admin ─────────────────────────────────────────────────────────────────
  public readonly admin = {
    getHealth: () =>
      this.request<{
        status: string;
        indexer: Array<Record<string, unknown>>;
        featureFlags: Record<string, boolean>;
      }>("/v1/admin/health"),
    simulateFailure: (data: SimulateFailureBody) =>
      this.request<Record<string, unknown>>("/v1/admin/simulate/failure", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  };
}

export function createApiClient(baseUrl?: string): OneIdClient {
  return new OneIdClient(baseUrl ? { baseUrl } : {});
}
