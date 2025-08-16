# Graph Theory Knowledge Graph (with local Ollama)

Interactive Knowledge Graph app with:
- Pan/zoom/drag (D3)
- Neighbor highlighting & shortest path (directed/undirected)
- Category filter & edge labels
- Upload or select a graph JSON from `/graphs`
- Node click → query **local** Ollama (`llama3.2`) and render **Markdown** with
  - Code highlighting (highlight.js)
  - LaTeX math (KaTeX)
  - Copy buttons on code blocks
  - Download AI response as Markdown

## Quick Start

### 0) Prerequisites
- Docker + Docker Compose
- [Ollama](https://ollama.com) running *on your host* with `llama3.2`:
  ```bash
  ollama pull llama3.2
  ollama serve
