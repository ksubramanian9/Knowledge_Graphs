(async () => {
  // ----- Graph selection -----
  const selGraph = document.getElementById("selGraph");
  const fileGraphs = document.getElementById("fileGraphs");
  const list = await fetch("/graphs").then(r => r.json()).catch(() => []);
  list.forEach(name => { const o=document.createElement("option"); o.value=name; o.textContent=name; selGraph.appendChild(o); });
  const params = new URLSearchParams(location.search);
  let current = params.get("graph");
  if (!current || !list.includes(current)) current = list[0];
  if (current) selGraph.value = current;
  selGraph.addEventListener("change", () => { location.search = `?graph=${selGraph.value}`; });
  fileGraphs.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    const graphs = await Promise.all(files.map(async f => ({ name:f.name, data: JSON.parse(await f.text()) })));
    if (graphs.length) {
      const resp = await fetch("/graphs", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ graphs }) });
      if (!resp.ok) { flash("Upload failed"); return; }
      location.search = `?graph=${graphs[0].name}`;
    }
  });
  if (!current) return;
  const graphData = await fetch(`/graphs/${current}`).then(r => r.json());

  const nodeById = new Map(graphData.nodes.map(n => [n.id, n]));
  graphData.links = graphData.links.map(e => ({
    source: nodeById.get(e.s) || e.s,
    target: nodeById.get(e.t) || e.t,
    label: e.label || "",
    directed: !!e.directed
  }));

  const cats = Array.from(new Set(graphData.nodes.map(n => n.cat))).sort();
  const catColors = d3.scaleOrdinal()
    .domain(cats)
    .range(d3.schemeTableau10.concat(d3.schemeSet3).slice(0, cats.length));
  const selCat = document.getElementById("selCat");
  cats.forEach(c => { const o = document.createElement("option"); o.value=c; o.textContent=c; selCat.appendChild(o); });
  const legend = document.getElementById("legend");
  cats.forEach(c => { const span=document.createElement("span"); const sw=document.createElement("b"); sw.style.background=catColors(c); span.appendChild(sw); span.appendChild(document.createTextNode(c)); legend.appendChild(span); });

  const svg = d3.select("#graph");
  const width = svg.node().clientWidth || 800;
  const height = svg.node().clientHeight || 600;

  const zoomLayer = svg.append("g");
  const linkLayer = zoomLayer.append("g").attr("stroke", "#334155").attr("stroke-opacity", 0.6);
  const labelLayer = zoomLayer.append("g").attr("font-size", 10).attr("fill", "#a3a3a3");
  const nodeLayer = zoomLayer.append("g");

  const defs = svg.append("defs");
  defs.append("marker").attr("id","arrow").attr("viewBox","0 -5 10 10")
    .attr("refX",16).attr("refY",0).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto")
    .append("path").attr("d","M0,-5L10,0L0,5").attr("fill","#475569");

  // Simulation INIT BEFORE USE
  const simulation = d3.forceSimulation(graphData.nodes)
    .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(70).strength(0.4))
    .force("charge", d3.forceManyBody().strength(-260))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collide", d3.forceCollide().radius(30));

  const links = linkLayer.selectAll("line").data(graphData.links).join("line")
    .attr("stroke-width", 1.5).attr("marker-end", d => d.directed ? "url(#arrow)" : null);

  const edgeLabels = labelLayer.selectAll("text").data(graphData.links).join("text")
    .attr("class","edge-label").attr("text-anchor","middle").attr("display","none").text(d => d.label);

  const nodes = nodeLayer.selectAll("g.node").data(graphData.nodes).join("g")
    .attr("class","node").call(drag(simulation));

  nodes.append("circle").attr("r",10).attr("fill", d => catColors(d.cat)).attr("stroke","#1f2937").attr("stroke-width",1.5);
  nodes.append("text").text(d => d.id).attr("x",12).attr("y","0.31em").attr("fill","#cbd5e1").attr("font-size",11);
  nodes.append("title").text(d => `${d.id} • ${d.cat}`);

  simulation.on("tick", () => {
    links.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
         .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
    nodes.attr("transform", d => `translate(${d.x},${d.y})`);
    edgeLabels.attr("x", d => (d.source.x + d.target.x)/2).attr("y", d => (d.source.y + d.target.y)/2 - 4);
  });

  svg.call(d3.zoom().scaleExtent([0.2, 4]).on("zoom", (event) => zoomLayer.attr("transform", event.transform)));

  const status = document.getElementById("status");
  const chkLabels = document.getElementById("chkLabels");
  const chkDirected = document.getElementById("chkDirected");
  const search = document.getElementById("search");
  const btnFocus = document.getElementById("btnFocus");
  const btnReset = document.getElementById("btnReset");
  const btnPath = document.getElementById("btnPath");
  const btnDownload = document.getElementById("btnDownload");
  const btnSelfTest = document.getElementById("btnSelfTest");
  const btnDownloadMD = document.getElementById("btnDownloadMD");

  chkLabels.addEventListener("change", () => edgeLabels.attr("display", chkLabels.checked ? null : "none"));

  btnReset.addEventListener("click", () => { clearStyling(); simulation.alpha(0.7).restart(); status.textContent = ""; });

  selCat.addEventListener("change", () => {
    const v = selCat.value;
    nodes.attr("display", d => (v === "ALL" || d.cat === v) ? null : "none");
    const visible = new Set();
    nodes.each(function(d){ if (this.getAttribute("display") !== "none") visible.add(d); });
    links.attr("display", d => (visible.has(d.source) && visible.has(d.target)) ? null : "none");
    edgeLabels.attr("display", d => (chkLabels.checked && visible.has(d.source) && visible.has(d.target)) ? null : "none");
  });

  btnFocus.addEventListener("click", () => {
    const q = search.value.trim();
    if (!q) return;
    const n = nodeById.get(q);
    if (!n) { flash(`No node named "${q}"`); return; }
    focusNode(n);
  });

  btnPath.addEventListener("click", () => {
    const raw = search.value.trim();
    if (!raw.includes("->") && !raw.includes(",")) { flash('Enter "A -> B" or "A,B" in the search box for path.'); return; }
    const [a, b] = raw.includes("->") ? raw.split("->").map(s => s.trim()) : raw.split(",").map(s => s.trim());
    const src = nodeById.get(a), dst = nodeById.get(b);
    if (!src || !dst) { flash("Unknown node(s)"); return; }
    const path = shortestPath(src.id, dst.id, chkDirected.checked);
    if (!path) { flash("No path found"); return; }
    showPath(path);
  });

  btnDownload.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(serializeGraph(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = current || "graph.json"; a.click();
    URL.revokeObjectURL(url);
  });

  btnSelfTest.addEventListener("click", () => {
    const report = selfTest();
    flash(report.ok ? "Self-Test OK" : "Self-Test failed — check panel", report.ok ? "ok" : "warn");
    renderMeta({ id:"Self-Test", cat:"Diagnostic", info: report.text });
    renderMarkdownToAnswer([
      "### Markdown + Code + Math demo",
      "",
      "```python",
      "def bfs(G, s):",
      "    from collections import deque",
      "    q, seen = deque([s]), {s}",
      "    while q:",
      "        v = q.popleft()",
      "        for w in G[v]:",
      "            if w not in seen:",
      "                seen.add(w); q.append(w)",
      "    return seen",
      "```",
      "",
      "Euler’s formula: $V - E + F = 2$ ",
      "",
      "$$\\chi(G) \\ge \\frac{|V|}{\\alpha(G)}$$"
    ].join("\n"));
  });

  btnDownloadMD.addEventListener("click", () => {
    const md = lastMd || "(no AI response yet)";
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "ai-explanation.md"; a.click();
    URL.revokeObjectURL(url);
  });

  nodes.on("click", async (event, d) => {
    clearStyling();
    highlightNeighborhood(d, 1);
    focusNode(d);
    await askOllama(d);
  });

  function drag(sim) {
    return d3.drag()
      .on("start", (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end",  (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
  }

  function clearStyling() {
    links.attr("stroke", "#334155").attr("stroke-width", 1.5).attr("opacity", 0.9);
    nodes.selectAll("circle").attr("stroke", "#1f2937").attr("stroke-width", 1.5).attr("opacity", 1);
    nodes.selectAll("text").attr("font-weight", null);
  }

  function highlightNeighborhood(node, depth=1) {
    const nbrs = new Set([node.id]);
    for (let k=0;k<depth;k++) {
      graphData.links.forEach(e => {
        if (nbrs.has(e.source.id)) nbrs.add(e.target.id);
        if (nbrs.has(e.target.id)) nbrs.add(e.source.id);
      });
    }
    nodes.selectAll("circle").attr("opacity", d => nbrs.has(d.id) ? 1 : 0.2);
    nodes.selectAll("text").attr("font-weight", d => nbrs.has(d.id) ? 700 : null).attr("opacity", d => nbrs.has(d.id) ? 1 : 0.2);
    links.attr("opacity", d => (nbrs.has(d.source.id) && nbrs.has(d.target.id)) ? 1 : 0.1)
         .attr("stroke-width", d => (d.source.id===node.id || d.target.id===node.id) ? 2.4 : 1.5);
  }

  function focusNode(n) {
    renderMeta(n);
    const t = d3.zoomTransform(svg.node());
    const point = [n.x, n.y];
    const target = d3.zoomIdentity.translate(width/2, height/2).scale(t.k).translate(-point[0], -point[1]);
    svg.transition().duration(450).call(d3.zoom().transform, target);
  }

  function showPath(pathIds) {
    clearStyling();
    const onPath = new Set(pathIds);
    links.attr("opacity", d => (onPath.has(d.source.id) && onPath.has(d.target.id)) ? 1 : 0.1)
         .attr("stroke", d => (onPath.has(d.source.id) && onPath.has(d.target.id)) ? "#f59e0b" : "#334155")
         .attr("stroke-width", d => (onPath.has(d.source.id) && onPath.has(d.target.id)) ? 3 : 1.5);
    nodes.selectAll("circle").attr("opacity", d => onPath.has(d.id) ? 1 : 0.15)
         .attr("stroke", d => onPath.has(d.id) ? "#f59e0b" : "#1f2937").attr("stroke-width", 2);
    nodes.selectAll("text").attr("font-weight", d => onPath.has(d.id) ? 700 : null);
    const last = nodeById.get(pathIds[pathIds.length-1]); if (last) focusNode(last);
    flash(`Path: ${pathIds.join(" → ")}`);
  }

  function shortestPath(aId, bId, directed=false) {
    const adj = new Map();
    graphData.nodes.forEach(n => adj.set(n.id, []));
    graphData.links.forEach(e => {
      adj.get(e.source.id).push(e.target.id);
      if (!directed || !e.directed) adj.get(e.target.id).push(e.source.id);
      else if (directed && !e.directed) adj.get(e.target.id).push(e.source.id);
    });
    const q = [aId], prev = new Map([[aId, null]]), seen = new Set([aId]);
    while (q.length) {
      const v = q.shift();
      if (v === bId) break;
      for (const w of adj.get(v)) {
        if (!seen.has(w)) { seen.add(w); prev.set(w, v); q.push(w); }
      }
    }
    if (!prev.has(bId)) return null;
    const path = []; for (let cur=bId; cur!==null; cur=prev.get(cur)) path.push(cur); path.reverse(); return path;
  }

  function renderMeta(n) {
    const meta = document.getElementById("nodeMeta"); meta.innerHTML = "";
    [["Label", n.id],["Category", n.cat]].forEach(([k,v]) => {
      const a=document.createElement("div"); a.textContent=k;
      const b=document.createElement("div"); b.textContent=v;
      meta.appendChild(a); meta.appendChild(b);
    });
  }

  // --- Markdown pipeline + copy buttons + KaTeX ---
  let lastMd = "";

  function renderMarkdownToAnswer(md) {
    lastMd = md;
    const box = document.getElementById("answer");
    try {
      const rawHtml = marked.parse(md, { gfm:true, breaks:true, headerIds:false, mangle:false });
      const safeHtml = DOMPurify.sanitize(rawHtml);
      box.innerHTML = safeHtml;

      // Syntax highlighting
      if (window.hljs) {
        box.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
      }
      // KaTeX auto-render
      if (window.renderMathInElement) {
        renderMathInElement(box, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$",  right: "$",  display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true }
          ],
          throwOnError: false
        });
      }
      // Copy buttons
      attachCopyButtons(box);
    } catch (e) {
      box.innerHTML = `<span class="warn">Markdown render error:</span> ${e.message}`;
    }
  }

  function attachCopyButtons(scopeEl) {
    scopeEl.querySelectorAll("pre").forEach((pre) => {
      // Avoid duplicates
      if (pre.querySelector(".copy-btn")) return;
      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        const code = pre.querySelector("code");
        const text = code ? code.innerText : pre.innerText;
        try {
          await navigator.clipboard.writeText(text);
          const old = btn.textContent; btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = old), 1200);
        } catch {
          btn.textContent = "Failed";
          setTimeout(() => (btn.textContent = "Copy"), 1200);
        }
      });
      pre.appendChild(btn);
    });
  }

  async function askOllama(n) {
    const box = document.getElementById("answer");
    box.innerHTML = "Querying Ollama…";
    const prompt = `You are a graph theory tutor. Explain the concept "${n.id}" in depth: definition, key properties, relationships to adjacent concepts in a knowledge graph (like ${neighborsOf(n.id).slice(0,6).join(", ")}), common pitfalls, 1-2 worked examples, and when to use it. Use Markdown with code blocks and LaTeX where helpful.`;
    try {
      const resp = await fetch("/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, temperature: 0.2, max_tokens: 900 })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Proxy error");
      renderMarkdownToAnswer(data.response || "(empty)");
    } catch (e) {
      box.innerHTML = `<span class="warn">Couldn’t reach Ollama proxy:</span> ${e.message}`;
    }
  }

  function neighborsOf(id) {
    const out = new Set();
    graphData.links.forEach(e => { if (e.source.id===id) out.add(e.target.id); if (e.target.id===id) out.add(e.source.id); });
    return Array.from(out);
  }

  function flash(msg, cls) { status.textContent = msg; status.className = "small " + (cls || ""); setTimeout(() => { status.textContent = ""; }, 4000); }

  function serializeGraph() {
    return {
      nodes: graphData.nodes.map(({id, cat}) => ({id, cat})),
      links: graphData.links.map(e => ({ s:e.source.id, t:e.target.id, label:e.label, directed:e.directed }))
    };
  }

  function selfTest() {
    const issues = [];
    if (!simulation) issues.push("simulation not created");
    const p1 = shortestPath("Graph", "Dijkstra", false);
    if (!p1 || p1.length < 2) issues.push("shortestPath(Graph,Dijkstra) failed");
    const p2 = shortestPath("Topological Sort", "Graph", true);
    if (!p2) issues.push("directed shortestPath failed (Topological Sort → Graph)");
    const nbs = neighborsOf("Graph"); if (!nbs.length) issues.push("neighborsOf(Graph) empty");
    if (!cats.includes("Graph Types")) issues.push("category missing: Graph Types");
    if (!window.marked || !window.DOMPurify) issues.push("markdown libs missing");
    if (!window.hljs) issues.push("highlight.js missing");
    if (!window.katex || !window.renderMathInElement) issues.push("KaTeX libs missing");
    // Copy buttons smoke test (create a fake pre/code)
    try {
      const tmp = document.createElement("div");
      tmp.innerHTML = "<pre><code>print(42)</code></pre>";
      attachCopyButtons(tmp);
      if (!tmp.querySelector(".copy-btn")) issues.push("copy buttons missing");
    } catch(e) { issues.push("copy button error: " + e.message); }
    return { ok: issues.length === 0, text: issues.length ? "Issues:\n- " + issues.join("\n- ") : "All tests passed." };
  }
})();
