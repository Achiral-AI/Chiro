import { Chiro, type FetchLike } from "./index.js";

type CapturedRequest = {
  url: string;
  init?: RequestInit;
};

function captureFetch(requests: CapturedRequest[]): FetchLike {
  return async (input, init) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });
  };
}

async function run() {
  const requests: CapturedRequest[] = [];
  const chiro = new Chiro({
    apiKey: "acm_test",
    baseURL: "https://example.achiral.ai/v1",
    agent: "api-sentinel",
    fetch: captureFetch(requests),
  });

  await chiro.retrieve({ query: "auth" });
  await chiro.recall({ query: "auth alias" });
  await chiro.encode({ content: "JWT keys rotate weekly." });
  await chiro.remember({ content: "JWT keys rotate weekly alias." });
  await chiro.reinforce("mem_123", { reason: "used" });
  await chiro.suppress("mem_123", { reason: "stale" });
  await chiro.explain("mem_123");
  await chiro.delete("mem_123");

  assertPath(requests[0], "/memory/agents/api-sentinel/retrieve");
  assertPath(requests[1], "/memory/agents/api-sentinel/retrieve");
  assertPath(requests[2], "/memory/agents/api-sentinel");
  assertPath(requests[3], "/memory/agents/api-sentinel");
  assertPath(requests[4], "/memory/agents/api-sentinel/mem_123/reinforce");
  assertPath(requests[5], "/memory/agents/api-sentinel/mem_123/suppress");
  assertPath(requests[6], "/memory/agents/api-sentinel/mem_123/provenance");
  assertPath(requests[7], "/memory/agents/api-sentinel/mem_123");

  const orgRequests: CapturedRequest[] = [];
  const orgChiro = new Chiro({
    apiKey: "acm_test",
    baseURL: "https://example.achiral.ai/v1",
    fetch: captureFetch(orgRequests),
  });

  await orgChiro.reinforce("mem_456", { reason: "used" });
  await orgChiro.delete("mem_456");

  assertPath(orgRequests[0], "/memory/mem_456/reinforce");
  assertPath(orgRequests[1], "/memory/mem_456");
}

function assertPath(request: CapturedRequest | undefined, path: string) {
  if (!request) throw new Error(`Missing request for ${path}`);
  const actual = new URL(request.url).pathname;
  if (actual !== `/v1${path}`) {
    throw new Error(`Expected /v1${path}, got ${actual}`);
  }
}

await run();
