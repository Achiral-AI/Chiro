import { Chiro } from "@achiral/chiro";

const memory = new Chiro({
  apiKey: process.env.ACHIRAL_API_KEY!,
  baseURL: process.env.ACHIRAL_BASE_URL,
});

export async function buildMemoryContext(userRequest: string) {
  const recall = await memory.recall({
    query: userRequest,
    includeContext: true,
  });

  return recall.context?.systemBlock ?? "";
}
