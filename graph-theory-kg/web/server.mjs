import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { promises as fsp } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors());

// --- Config ---
const PORT = process.env.PORT || 3000;
const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
const KG_NAME = process.env.KG_NAME || "Graph Theory KG";

// --- Graph storage ---
const graphsDir = path.join(__dirname, "graphs");
if (!fs.existsSync(graphsDir)) {
  fs.mkdirSync(graphsDir, { recursive: true });
}

// --- Proxy endpoint ---
app.post("/ask", async (req, res) => {
  const { prompt, temperature = 0.2, max_tokens = 900 } = req.body || {};
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Missing prompt" });
  }
  try {
    const r = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        prompt,
        stream: false,
        options: { temperature },
        keep_alive: "5m"
      })
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: txt });
    }
    const data = await r.json(); // { response: "...", ... }
    res.json({ response: data.response || "" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Graph management ---
app.get("/graphs", async (_, res) => {
  try {
    const files = await fsp.readdir(graphsDir);
    res.json(files.filter((f) => f.endsWith(".json")));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get("/graphs/:name", async (req, res) => {
  const file = path.join(graphsDir, path.basename(req.params.name));
  try {
    const data = await fsp.readFile(file, "utf8");
    res.type("application/json").send(data);
  } catch (err) {
    res.status(404).json({ error: "Not found" });
  }
});

app.post("/graphs", async (req, res) => {
  const { graphs } = req.body || {};
  if (!Array.isArray(graphs) || !graphs.length) {
    return res.status(400).json({ error: "No graphs provided" });
  }
  try {
    for (const g of graphs) {
      if (!g || !g.name || !g.data) continue;
      const file = path.join(graphsDir, path.basename(g.name));
      await fsp.writeFile(file, JSON.stringify(g.data, null, 2));
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// --- Static files ---
const pub = path.join(__dirname, "public");
app.use(express.static(pub));

// Fallback to index.html
app.get("*", (_, res) => res.sendFile(path.join(pub, "index.html")));

app.listen(PORT, () => {
  console.log(`${KG_NAME} on http://localhost:${PORT}`);
  console.log(`Proxy -> ${OLLAMA_BASE_URL}/api/generate`);
});
