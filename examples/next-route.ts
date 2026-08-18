import { Chiro } from "@achiral/chiro";

const memory = new Chiro({
  apiKey: process.env.ACHIRAL_API_KEY!,
  baseURL: process.env.ACHIRAL_BASE_URL,
});

export async function POST(request: Request) {
  const { query } = await request.json();
  const retrieval = await memory.retrieve({ query, includeContext: true });
  return Response.json(retrieval);
}
