// ingest.js — Indexation des PDFs dans LanceDB via Ollama embeddings
// Usage: node ingest.js ./pdfs
// Dépose tes PDFs dans le dossier ./pdfs/ avant de lancer

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { connect } from "vectordb";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH  = path.join(__dirname, "db");
const PDF_DIR  = process.argv[2] ?? path.join(__dirname, "pdfs");
const TABLE    = "rules";

const CHUNK_SIZE    = 300;   // tokens approximatifs par chunk
const CHUNK_OVERLAP = 30;    // overlap entre chunks

// ─── Ollama embeddings ────────────────────────────────────────────────────────

async function embed(texts) {
  const results = [];
  for (const text of texts) {
    const res = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    results.push(data.embedding);
  }
  return results;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

function chunkText(text, source) {
  const clean = text
    .replace(/\f/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const TARGET  = CHUNK_SIZE * 4;   // ~4 chars par token
  const OVERLAP = CHUNK_OVERLAP * 4;

  // Découpe d'abord par paragraphes, puis force-coupe si trop long
  const paragraphs = clean.split(/\n\n+/);
  const chunks = [];
  let current = "";

  for (const para of paragraphs) {
    // Si le paragraphe seul est déjà trop long → force-coupe par mots
    if (para.length > TARGET) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      const words = para.split(" ");
      let sub = "";
      for (const word of words) {
        if (sub.length + word.length > TARGET) {
          chunks.push(sub.trim());
          sub = sub.split(" ").slice(-CHUNK_OVERLAP / 10).join(" ") + " " + word;
        } else {
          sub += " " + word;
        }
      }
      if (sub.trim()) current = sub.trim();
      continue;
    }

    if (current.length + para.length > TARGET && current.length > 0) {
      chunks.push(current.trim());
      const words = current.split(" ");
      current = words.slice(-CHUNK_OVERLAP / 4 | 0).join(" ") + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks.map((text, i) => ({
    text,
    source,
    chunk_index: i,
    id: `${source}::${i}`,
  }));
}

// ─── Extraction PDF ───────────────────────────────────────────────────────────

async function extractPdf(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text;
}

// ─── Collecte des fichiers ────────────────────────────────────────────────────

function collectFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectFiles(full));
    else if (entry.name.endsWith(".pdf") || entry.name.endsWith(".md"))
      results.push(full);
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(PDF_DIR)) {
    console.error(`Dossier introuvable : ${PDF_DIR}`);
    console.error(`Crée le dossier et dépose-y tes PDFs, puis relance.`);
    process.exit(1);
  }

  const files = collectFiles(PDF_DIR);
  if (files.length === 0) {
    console.error(`Aucun fichier PDF ou MD trouvé dans ${PDF_DIR}`);
    process.exit(1);
  }

  console.log(`📚 ${files.length} fichier(s) trouvé(s)\n`);

  // Connexion LanceDB
  const db = await connect(DB_PATH);

  // Supprime la table existante pour réindexer proprement
  const tables = await db.tableNames();
  if (tables.includes(TABLE)) {
    await db.dropTable(TABLE);
    console.log("🗑️  Table existante supprimée (réindexation complète)\n");
  }

  let allRecords = [];

  for (const filePath of files) {
    const source = path.relative(PDF_DIR, filePath);
    console.log(`📄 Traitement : ${source}`);

    try {
      let text;
      if (filePath.endsWith(".pdf")) {
        text = await extractPdf(filePath);
      } else {
        text = fs.readFileSync(filePath, "utf-8");
      }

      const chunks = chunkText(text, source);
      console.log(`   → ${chunks.length} chunks`);

      // Embeddings par batch de 10
      const BATCH = 10;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const batch = chunks.slice(i, i + BATCH);
        const texts = batch.map((c) => c.text);
        const vectors = await embed(texts);

        for (let j = 0; j < batch.length; j++) {
          allRecords.push({
            id:          batch[j].id,
            source:      batch[j].source,
            chunk_index: batch[j].chunk_index,
            text:        batch[j].text,
            vector:      vectors[j],
          });
        }

        process.stdout.write(`   → embedding ${Math.min(i + BATCH, chunks.length)}/${chunks.length}\r`);
      }
      console.log(`   ✅ ${chunks.length} chunks indexés`);

    } catch (err) {
      console.warn(`   ⚠️  Erreur sur ${source}: ${err.message}`);
    }
  }

  // Création de la table LanceDB
  if (allRecords.length === 0) {
    console.error("Aucun chunk généré.");
    process.exit(1);
  }

  await db.createTable(TABLE, allRecords);
  console.log(`\n📦 Base créée : ${allRecords.length} chunks indexés dans ${DB_PATH}`);
  console.log(`\nTu peux maintenant lancer le MCP server : node index.js`);
}

main().catch((err) => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
