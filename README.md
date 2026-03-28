# Campagne D&D 3.5 — dépôt outillage et lore

Ce dépôt regroupe le **lore de campagne** en Markdown et un **serveur RAG** (recherche sémantique sur des PDF de règles) exposé à Cursor via **MCP**.

## Contenu principal

| Élément | Rôle |
|--------|------|
| `lore/` | Articles de campagne (ex. export World Anvil en `.md`) : personnages, lieux, intrigues, etc. |
| `convert.js` | Export World Anvil (JSON) → Markdown dans `lore/`. |
| `rag-server/` | Indexation des PDF (LanceDB + Ollama) et serveur MCP `search_rules`. |
| `.cursor/` | Règles pour l’assistant MJ et configuration MCP. |

Les PDF de règles ne sont pas versionnés : ils restent en local, comme la base générée après indexation.

**Installation, prérequis et mode d’emploi** (World Anvil → `lore/`, PDF → RAG, Ollama, Cursor/MCP, chemins, git) : voir **`rag-server/setup/setup.txt`**.

---

# D&D 3.5 campaign — tooling and lore

This repo holds **campaign lore** as Markdown and a **RAG server** (semantic search over rule PDFs) exposed to Cursor via **MCP**.

## Main pieces

| Item | Purpose |
|------|---------|
| `lore/` | Campaign articles (e.g. World Anvil export as `.md`): characters, locations, plots, etc. |
| `convert.js` | World Anvil export (JSON) → Markdown under `lore/`. |
| `rag-server/` | PDF indexing (LanceDB + Ollama) and MCP server `search_rules`. |
| `.cursor/` | GM assistant rules and MCP configuration. |

Rule PDFs and the generated vector DB are not tracked in git; keep them local.

**Setup, requirements, and usage** (World Anvil → `lore/`, PDF → RAG, Ollama, Cursor/MCP, paths, git): see **`rag-server/setup/setup.txt`**.
