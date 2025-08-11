# Knowledge\_Graphs

A collection of interactive **Knowledge Graphs** you can run locally with Docker. Each graph is a mini app with:

* Interactive D3 canvas (pan/zoom/drag, search, category filter)
* Neighbor highlighting & shortest-path (directed/undirected)
* Click a node → query a **local LLM** (via a built-in proxy; defaults to **Ollama**)
* Markdown rendering with code highlighting + LaTeX math
* One-click “Download Data” (graph JSON) and “Download AI Markdown”

> Think of this repo as a **monorepo**: each subfolder is a self-contained KG app with its own `docker-compose.yml`, assets, and documentation.

---

## Repository structure

```
Knowledge_Graphs/
├─ graph_theory_kg/          # Graph Theory KG (ready to run)
│  ├─ docker-compose.yml
│  ├─ README.md
│  └─ web/
│     ├─ Dockerfile
│     ├─ package.json
│     ├─ server.mjs         # Serves UI + proxies /ask → local Ollama
│     └─ public/
│        └─ index.html      # D3 UI, Markdown + KaTeX, code copy buttons
├─ <your_next_kg>/           # Add more KGs here (same structure)
└─ shared/                   # (optional) Shared code, schemas, CI, etc.
```

> Folder naming convention: use **snake\_case** with the suffix `_kg` (e.g., `graph_theory_kg`, `linear_algebra_kg`, `mongodb_kg`).

---

## Quick start (any KG)

### Prerequisites

* **Docker** and **Docker Compose**
* (Default) **Ollama** running on your host with the target model pulled

  ```bash
  ollama pull llama3.2
  ollama serve
  ```

  Ollama default endpoint: `http://localhost:11434`

### Run a knowledge graph

From the KG folder (e.g., `graph_theory_kg/`):

```bash
docker compose up --build
```

Open the app:

```
http://localhost:3000
```

The container serves the UI and proxies `/ask` to your host’s Ollama at `http://host.docker.internal:11434`. On Linux, the compose file maps that hostname to the host gateway.

---

## Included knowledge graphs

| Knowledge Graph | Path              | Port | LLM Integration                | Notes                                                                 |
| --------------- | ----------------- | ---- | ------------------------------ | --------------------------------------------------------------------- |
| Graph Theory    | `graph_theory_kg` | 3000 | Ollama (`llama3.2`) via `/ask` | D3 canvas, shortest-path, Markdown+KaTeX, code copy, download JSON/MD |

> Add more graphs as sibling folders following the same structure.

---

## Common features (per KG)

* **Graph UI**

  * Pan/zoom/drag
  * Node categories & legend
  * Edge labels toggle
  * Neighbor highlighting (1-hop)
  * Shortest path (directed/undirected toggle)
* **LLM side panel**

  * Click a node → sends a prompt to `/ask`
  * Renders Markdown with **highlight.js** for code and **KaTeX** for math
  * Copy buttons on each code block
  * “Download AI Markdown” to save the latest response
* **Data export**

  * “Download JSON” exports the graph (nodes/links) in a stable schema
* **Self-Test**

  * Quick wiring check (simulation, pathfinding, markdown/KaTeX/HLJS presence)

---

## Data format (JSON)

Each KG’s UI expects this normalized shape:

```json
{
  "nodes": [
    { "id": "Graph", "cat": "Foundations" }
  ],
  "links": [
    { "s": "Graph", "t": "Vertex", "label": "has", "directed": false }
  ]
}
```

At runtime, the UI resolves `s/t` to actual node objects and derives `source/target` for D3. Keep `id` unique across nodes.

---

## LLM integration

* The frontend POSTs to `POST /ask` with:

  ```json
  { "prompt": "…", "temperature": 0.2, "max_tokens": 900 }
  ```
* The server proxies to **Ollama** (`/api/generate`) and returns:

  ```json
  { "response": "markdown text from model" }
  ```
* Change the LLM endpoint per KG by editing `docker-compose.yml`:

  ```yaml
  environment:
    OLLAMA_BASE_URL: "http://host.docker.internal:11434"
  ```
* To swap models, adjust `server.mjs` (e.g., `model: "llama3.2"` → another local model).

---

## Add a new knowledge graph

1. **Copy a template**

   * Duplicate `graph_theory_kg` → `your_topic_kg`
2. **Edit metadata**

   * Update the title, legend labels, and the `graphData` (nodes/links) in `public/index.html`
3. **Choose a port**

   * If you’ll run multiple KGs at once, change the published port in that folder’s `docker-compose.yml` (e.g., `3001:3000`)
4. **Tune the prompt**

   * In `public/index.html`, adjust the `askOllama()` prompt to fit your domain
5. **Run**

   ```bash
   cd your_topic_kg
   docker compose up --build
   ```

> Optional: move the shared UI into `shared/` and import it from each KG to reduce duplication. For now, each KG is fully standalone for simplicity.

---

## Troubleshooting

* **Blank AI panel / network error**
  Ensure `ollama serve` is running on the host and reachable at `http://localhost:11434`.
  Linux users: `host.docker.internal` is mapped via Compose (`extra_hosts: host-gateway`), but confirm your Docker version supports it.

* **Port already in use**
  Change the published port in the KG’s `docker-compose.yml` (e.g., `- "3001:3000"`).

* **Simulation error**
  We initialize the D3 `simulation` *before* it’s referenced (fixes `Cannot access 'simulation' before initialization`). If you extend the UI, keep that order intact.

---

## Contributing

* Use **feature branches** and submit **PRs** per KG
* Prefer **Conventional Commits** style (e.g., `feat(graph_theory_kg): add planarity examples`)
* Keep each KG self-contained and runnable with `docker compose up --build`
* If you add a new KG, update the table above

---

## Roadmap

* [ ] Template generator (`scripts/new-kg.sh`) to scaffold a KG from a stub
* [ ] Optional **Ollama** container in Compose (for fully in-Docker setups)
* [ ] Switchable streaming responses (SSE) for token-by-token rendering
* [ ] Shared UI package in `/shared/ui`
* [ ] Basic unit tests for client helpers (pathfinding, filtering)

---

## License

MIT — see individual KGs for any additional notices.


