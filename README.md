# @achiral/chiro

TypeScript SDK for the [Achiral Memory API](https://achiral.ai/memory-api).

`@achiral/chiro` is the official TypeScript SDK for adding Achiral Memory API retrieval, encoding, events, reinforcement, suppression, explanation, and deletion to AI-native applications.

## Install

```bash
npm install @achiral/chiro
```

```bash
pnpm add @achiral/chiro
```

## Quickstart

```ts
import { Chiro } from "@achiral/chiro";

const memory = new Chiro({
  apiKey: process.env.ACHIRAL_API_KEY,
  baseURL: "https://your-org.achiral.ai/v1",
});

const retrieval = await memory.retrieve({
  query: "What should this app remember?",
  includeContext: true,
});

await memory.encode({
  content: "User prefers release notes as bullet points.",
  source: "product-event",
});
```

## Agent-scoped memory

```ts
const agentMemory = new Chiro({
  apiKey: process.env.ACHIRAL_API_KEY,
  baseURL: "https://your-org.achiral.ai/v1",
  agent: "api-sentinel",
});

await agentMemory.encode({
  content: "The auth service rotates JWT signing keys every 7 days.",
  memoryKind: "architecture",
});
```

When `agent` is configured, `retrieve`, `encode`, `reinforce`, `suppress`, `explain`, and `delete` use agent-scoped Memory API paths by default. Without `agent`, they use organization-level memory. `recall()` and `remember()` remain natural aliases for `retrieve()` and `encode()`.

## Bring your own model

```ts
const retrieval = await memory.retrieve({
  query: "Draft a migration plan for auth.",
  namespace: "identity",
  intent: "plan auth migration",
  includeContext: true,
});

await openai.chat.completions.create({
  model: "gpt-5",
  messages: [
    { role: "system", content: retrieval.context?.systemBlock ?? "" },
    { role: "user", content: "What should we do next?" },
  ],
});
```

## API

- `memory.retrieve(input)`; natural alias: `memory.recall(input)`
- `memory.encode(input, options)`; natural alias: `memory.remember(input, options)`
- `memory.events.ingest(input, options)`
- `memory.reinforce(id, input)`
- `memory.suppress(id, input)`
- `memory.explain(id)`
- `memory.delete(id)`
- `memory.chat(input)`
- `memory.streamChat(input)`

Use `namespace` to keep memory for different apps, services, teams, or environments separate. Use `intent` to say why the current retrieval or encoding is happening.

## Streaming chat

```ts
const stream = await memory.streamChat({
  model: "chiro",
  messages: [
    { role: "user", content: "What should I know before touching auth?" },
  ],
});

for await (const chunk of stream) {
  console.log(chunk);
}
```

## Environment

```bash
export ACHIRAL_API_KEY=acm_...
export ACHIRAL_BASE_URL=https://your-org.achiral.ai/v1
```

## Package status

This package is the canonical V1 SDK for the Achiral Memory API. Framework packages should be thin adapters around this SDK and are intentionally deferred until the core API is stable.

## Release

This package uses SemVer. Publishing runs from GitHub Actions after a merge to `main`.

Required repository secret:

- `NPM_TOKEN`: npm automation token with publish access to `@achiral/chiro`

Update the version in `package.json` as part of the release PR. After merge, the workflow runs tests, checks the npm tarball, tags the package version, publishes to npm with provenance, and creates a GitHub release.

Primary registry for V1 is npm. GitHub Packages and JSR are deferred until there is a clear developer need for those channels.

## Resources

- Product page: https://achiral.ai/memory-api
- API docs: https://achiral.ai/docs/memory/api
- SDK docs: https://achiral.ai/docs/memory/api/sdk
- Shelby Memory Agents: https://achiral.ai/ai-agent-memory
