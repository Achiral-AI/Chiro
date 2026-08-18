import express from "express";
import { Chiro } from "@achiral/chiro";

const app = express();
app.use(express.json());

const memory = new Chiro({
  apiKey: process.env.ACHIRAL_API_KEY!,
  baseURL: process.env.ACHIRAL_BASE_URL,
});

app.post("/memory", async (request, response) => {
  const recall = await memory.recall({
    query: request.body.query,
    includeContext: true,
  });

  response.json(recall);
});

app.listen(3000);
