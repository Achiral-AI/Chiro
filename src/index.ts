export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ChiroOptions = {
  apiKey: string;
  baseURL?: string;
  agent?: string;
  fetch?: FetchLike;
  headers?: HeadersInit;
  retries?: number;
};

export type RequestOptions = {
  idempotencyKey?: string;
  signal?: AbortSignal;
  headers?: HeadersInit;
};

export type MemoryScope = {
  agent?: string;
  userId?: string;
  namespace?: string;
  intent?: string;
};

export type ScopedRequestOptions = RequestOptions & MemoryScope;

export type RecallInput = MemoryScope & {
  query: string;
  limit?: number;
  includeContext?: boolean;
  contextMode?: "lite" | "full";
  explain?: boolean;
  filters?: Record<string, unknown>;
};

export type RememberInput = MemoryScope & {
  content?: string;
  text?: string;
  subject?: string;
  source?: string;
  memoryKind?: string;
  confidence?: number;
  visibility?: "organization" | "agent" | "user";
  metadata?: Record<string, unknown>;
  validFrom?: string;
  validUntil?: string;
  supersedes?: string[];
  contradicts?: string[];
};

export type MemoryEventInput = MemoryScope & {
  type: string;
  source: string;
  subject?: string;
  text?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
};

export type ReinforceInput = {
  reason?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
};

export type SuppressInput = {
  reason?: string;
  until?: string;
  metadata?: Record<string, unknown>;
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ChatInput = {
  model?: string;
  messages: ChatMessage[];
  stream?: false;
  memory?: "off" | "lite" | "full";
  [key: string]: unknown;
};

export type StreamChatInput = Omit<ChatInput, "stream"> & {
  stream?: true;
};

export type ChatResponse = Record<string, unknown>;

export type ChatStreamChunk = Record<string, unknown>;

export type MemoryContext = {
  systemBlock?: string;
  stats?: Record<string, unknown>;
};

export type MemoryRecord = {
  id: string;
  content?: string;
  text?: string;
  score?: number;
  activationScore?: number;
  tier?: string;
  confidence?: number;
  source?: string | Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  lastAccessedAt?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
};

export type RecallResponse = {
  object?: "memory.search_result";
  memories?: MemoryRecord[];
  data?: MemoryRecord[];
  context?: MemoryContext;
  [key: string]: unknown;
};

export type RememberResponse = {
  id?: string;
  object?: string;
  memory?: MemoryRecord;
  candidate?: unknown;
  [key: string]: unknown;
};

export class ChiroError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly response?: unknown;

  constructor(message: string, options: { status: number; code?: string; response?: unknown }) {
    super(message);
    this.name = "ChiroError";
    this.status = options.status;
    this.code = options.code;
    this.response = options.response;
  }
}

export class Chiro {
  readonly apiKey: string;
  readonly baseURL: string;
  readonly agent?: string;
  readonly retries: number;
  private readonly fetcher: FetchLike;
  private readonly defaultHeaders?: HeadersInit;

  readonly events = {
    ingest: (input: MemoryEventInput, options?: RequestOptions) =>
      this.request<unknown>("POST", "/memory/events", input, {
        ...options,
        idempotencyKey: options?.idempotencyKey ?? idempotencyKey("event", input),
      }),
  };

  constructor(options: ChiroOptions) {
    if (!options.apiKey) {
      throw new Error("Chiro requires an apiKey.");
    }

    this.apiKey = options.apiKey;
    this.baseURL = normalizeBaseURL(options.baseURL ?? "https://api.achiral.ai/v1");
    this.agent = options.agent;
    this.retries = options.retries ?? 2;
    this.fetcher = options.fetch ?? globalThis.fetch?.bind(globalThis);
    this.defaultHeaders = options.headers;

    if (!this.fetcher) {
      throw new Error("Chiro requires a fetch implementation.");
    }
  }

  recall(input: RecallInput, options?: RequestOptions) {
    return this.request<RecallResponse>("POST", this.memoryPath("/memory/search", input), input, options);
  }

  remember(input: RememberInput, options?: RequestOptions) {
    return this.request<RememberResponse>("POST", this.memoryPath("/memory", input), input, {
      ...options,
      idempotencyKey: options?.idempotencyKey ?? idempotencyKey("memory", input),
    });
  }

  reinforce(id: string, input: ReinforceInput = {}, options?: ScopedRequestOptions) {
    return this.request<unknown>(
      "POST",
      this.memoryControlPath(id, "reinforce", options),
      input,
      options,
    );
  }

  suppress(id: string, input: SuppressInput = {}, options?: ScopedRequestOptions) {
    return this.request<unknown>(
      "POST",
      this.memoryControlPath(id, "suppress", options),
      input,
      options,
    );
  }

  explain(id: string, options?: ScopedRequestOptions) {
    return this.request<unknown>(
      "GET",
      this.memoryControlPath(id, "provenance", options),
      undefined,
      options,
    );
  }

  delete(id: string, options?: ScopedRequestOptions) {
    return this.request<unknown>(
      "DELETE",
      this.memoryControlPath(id, undefined, options),
      undefined,
      options,
    );
  }

  chat(input: StreamChatInput & { stream: true }, options?: RequestOptions): Promise<AsyncIterable<ChatStreamChunk>>;
  chat(input: ChatInput, options?: RequestOptions): Promise<ChatResponse>;
  chat(input: ChatInput | (StreamChatInput & { stream: true }), options?: RequestOptions) {
    if (input.stream === true) {
      return this.streamChat(input, options);
    }
    return this.request<ChatResponse>("POST", this.chatPath(), input, options);
  }

  streamChat(input: StreamChatInput, options?: RequestOptions) {
    return this.requestStream<ChatStreamChunk>(
      "POST",
      this.chatPath(),
      { ...input, stream: true },
      options,
    );
  }

  private memoryPath(path: string, input: MemoryScope) {
    const agent = input.agent ?? this.agent;
    if (!agent) return path;
    if (path === "/memory/search") return `/memory/agents/${encodeURIComponent(agent)}/search`;
    if (path === "/memory") return `/memory/agents/${encodeURIComponent(agent)}`;
    return path;
  }

  private memoryControlPath(id: string, action?: string, scope?: MemoryScope) {
    const agent = scope?.agent ?? this.agent;
    const encodedId = encodeURIComponent(id);
    const suffix = action ? `/${action}` : "";
    if (!agent) return `/memory/${encodedId}${suffix}`;
    return `/memory/agents/${encodeURIComponent(agent)}/${encodedId}${suffix}`;
  }

  private chatPath() {
    return this.agent
      ? `/agents/${encodeURIComponent(this.agent)}/chat/completions`
      : "/chat/completions";
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const headers = this.headers(body, options);

    const attempts = shouldRetry(method) ? this.retries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetcher(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: options.signal,
        });

        if (response.ok) {
          if (response.status === 204) return undefined as T;
          return (await response.json()) as T;
        }

        const payload = await parseResponse(response);
        const message =
          errorMessage(payload) ?? `Achiral request failed with status ${response.status}`;
        const code = errorCode(payload);

        if (attempt < attempts - 1 && retryableStatus(response.status)) {
          await delay(backoffMs(attempt));
          continue;
        }

        throw new ChiroError(message, { status: response.status, code, response: payload });
      } catch (error) {
        lastError = error;
        if (error instanceof ChiroError || attempt >= attempts - 1) {
          throw error;
        }
        await delay(backoffMs(attempt));
      }
    }

    throw lastError;
  }

  private async requestStream<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<AsyncIterable<T>> {
    const response = await this.fetcher(`${this.baseURL}${path}`, {
      method,
      headers: this.headers(body, options),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const payload = await parseResponse(response);
      throw new ChiroError(
        errorMessage(payload) ?? `Achiral request failed with status ${response.status}`,
        { status: response.status, code: errorCode(payload), response: payload },
      );
    }

    if (!response.body) {
      throw new ChiroError("Achiral stream response did not include a body.", {
        status: response.status,
      });
    }

    return parseEventStream<T>(response.body);
  }

  private headers(body: unknown, options: RequestOptions) {
    const headers = new Headers(this.defaultHeaders);
    headers.set("authorization", `Bearer ${this.apiKey}`);
    headers.set("accept", "application/json");

    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }

    if (options.idempotencyKey) {
      headers.set("idempotency-key", options.idempotencyKey);
    }

    mergeHeaders(headers, options.headers);
    return headers;
  }
}

function normalizeBaseURL(baseURL: string) {
  return baseURL.replace(/\/+$/, "");
}

function shouldRetry(method: string) {
  return method === "GET" || method === "DELETE";
}

function retryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function backoffMs(attempt: number) {
  return Math.min(1000, 100 * 2 ** attempt);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function mergeHeaders(target: Headers, source?: HeadersInit) {
  if (!source) return;
  new Headers(source).forEach((value, key) => target.set(key, value));
}

function idempotencyKey(prefix: string, value: unknown) {
  return `${prefix}_${hashStable(JSON.stringify(stable(value)))}`;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, inner]) => [key, stable(inner)]),
  );
}

function hashStable(value: string) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

async function* parseEventStream<T>(body: ReadableStream<Uint8Array>): AsyncIterable<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const chunk = parseStreamEvent<T>(event);
        if (chunk !== undefined) yield chunk;
      }
    }

    buffer += decoder.decode();
    const chunk = parseStreamEvent<T>(buffer);
    if (chunk !== undefined) yield chunk;
  } finally {
    reader.releaseLock();
  }
}

function parseStreamEvent<T>(event: string): T | undefined {
  const data = event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!data || data === "[DONE]") return undefined;

  try {
    return JSON.parse(data) as T;
  } catch {
    return { data } as T;
  }
}

function errorMessage(payload: unknown) {
  if (!isRecord(payload)) return undefined;
  return stringValue(payload.message) ?? nestedErrorValue(payload, "message");
}

function errorCode(payload: unknown) {
  if (!isRecord(payload)) return undefined;
  return stringValue(payload.code) ?? nestedErrorValue(payload, "code");
}

function nestedErrorValue(payload: Record<string, unknown>, key: string) {
  return isRecord(payload.error) ? stringValue(payload.error[key]) : undefined;
}
