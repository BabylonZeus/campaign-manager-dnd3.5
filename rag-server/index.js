// index.js — MCP Server RAG pour campagne D&D
// Expose l'outil search_rules(query) à Cursor via le protocole MCP
// Lancement : node index.js

import path from "path";
import { fileURLToPath } from "url";
import { connect } from "vectordb";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, "db");
const TABLE     = "rules";
const TOP_K     = 5; // nombre de passages retournés par défaut

// ─── Ollama embedding (même fonction que ingest.js) ───────────────────────────

async function embed(text) {
  const res = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

// ─── Recherche vectorielle ────────────────────────────────────────────────────

async function searchRules(query, k = TOP_K, sourceFilter = null) {
  const db = await connect(DB_PATH);
  const table = await db.openTable(TABLE);

  const vector = await embed(query);

  let search = table.search(vector).limit(k);

  // Filtre optionnel par source (ex: "phb/" pour chercher uniquement dans le PHB)
  if (sourceFilter) {
    search = search.where(`source LIKE '${sourceFilter}%'`);
  }

  const results = await search.execute();

  return results.map((r) => ({
    source:      r.source,
    chunk_index: r.chunk_index,
    text:        r.text,
    score:       r._distance,
  }));
}

// ─── Formatage de la réponse pour Cursor ─────────────────────────────────────

function formatResults(results, query) {
  if (results.length === 0) {
    return `Aucun passage trouvé pour : "${query}"`;
  }

  const lines = [
    `## Résultats RAG pour : "${query}"`,
    `*(${results.length} passage(s) les plus pertinents)*\n`,
  ];

  for (const [i, r] of results.entries()) {
    lines.push(`### Passage ${i + 1} — ${r.source} (chunk ${r.chunk_index})`);
    lines.push(r.text);
    lines.push("");
  }

  return lines.join("\n");
}

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new Server(
  { name: "dnd-rag", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// Liste des outils exposés à Cursor
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_rules",
      description:
        "Recherche sémantique dans les règles D&D indexées (PHB, DMG, MM, suppléments, homebrews). " +
        "Retourne les passages les plus pertinents pour une question de règle ou de lore officiel.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "La question ou le concept à rechercher. Ex: 'résistance aux dégâts de feu', 'actions bonus en combat'",
          },
          k: {
            type: "number",
            description: "Nombre de passages à retourner (défaut: 5, max: 10)",
            default: 5,
          },
          source_filter: {
            type: "string",
            description: "Filtrer par source. Ex: 'phb/' pour le PHB uniquement, 'dmg/' pour le DMG. Laisser vide pour chercher partout.",
          },
        },
        required: ["query"],
      },
    },
  ],
}));

// Exécution des outils
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== "search_rules") {
    throw new Error(`Outil inconnu : ${name}`);
  }

  const query        = args.query;
  const k            = Math.min(args.k ?? TOP_K, 10);
  const sourceFilter = args.source_filter ?? null;

  try {
    const results  = await searchRules(query, k, sourceFilter);
    const text     = formatResults(results, query);

    return {
      content: [{ type: "text", text }],
    };
  } catch (err) {
    // Erreur lisible si la base n'existe pas encore
    if (err.message?.includes("does not exist") || err.message?.includes("No such file")) {
      return {
        content: [{
          type: "text",
          text: "⚠️ La base RAG n'est pas encore initialisée. Lance d'abord : node ingest.js ./pdfs",
        }],
      };
    }
    throw err;
  }
});

// ─── Démarrage ────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
// Le serveur tourne jusqu'à ce que Cursor le coupe
