# Campagne D&D 3.5 — repo outillage et lore

Ce repo a pour but de :

- faciliter l'accès au **fonctionnement de D&D 3.5**, dont le contenu est historiquement réparti dans de nombreuses sources (livres, magasines, sites web, ...) ;
- faciliter la **synthèse et l'accès au lore** de campagnes créées par le MJ dont le contenu peut être dans de nombreuses pages (testé avec **World Anvil** comme source).

Ce repo regroupe le **lore de campagne** en Markdown et un **serveur RAG** (recherche sémantique sur des PDF de règles) exposé à Cursor via **MCP**.

## Contenu principal

| Élément | Rôle |
|--------|------|
| `lore/` | Articles de campagne (ex. export World Anvil en `.md`) : personnages, lieux, intrigues, etc. |
| `convert.js` | Export World Anvil (JSON) → Markdown dans `lore/`. |
| `rag-server/` | Indexation des PDF (LanceDB + Ollama) et serveur MCP `search_dnd`. |
| `.cursor/` | Règles pour l’assistant MJ et configuration MCP. |

Les PDF de règles ne sont pas versionnés : ils restent en local, comme la base générée après indexation.

**Installation, prérequis et mode d’emploi** (World Anvil → `lore/`, PDF → RAG, Ollama, Cursor/MCP, chemins, git) : voir **`rag-server/setup/setup.txt`**.

---

# D&D 3.5 campaign — tooling and lore

This repository aims to:

- make **D&D 3.5 rules and play** easier to work with, given how the material is spread across many historical sources (books, magazines, websites, …);
- make it easier to **synthesize and browse campaign lore** created by the GM across many pages—**World Anvil** has been tested as a source.

It brings together **campaign lore** as Markdown and a **RAG server** (semantic search over rule PDFs) exposed to Cursor via **MCP**.

## Main pieces

| Item | Purpose |
|------|---------|
| `lore/` | Campaign articles (e.g. World Anvil export as `.md`): characters, locations, plots, etc. |
| `convert.js` | World Anvil export (JSON) → Markdown under `lore/`. |
| `rag-server/` | PDF indexing (LanceDB + Ollama) and MCP server `search_dnd`. |
| `.cursor/` | GM assistant rules and MCP configuration. |

Rule PDFs and the generated vector DB are not tracked in git; keep them local.

**Setup, requirements, and usage** (World Anvil → `lore/`, PDF → RAG, Ollama, Cursor/MCP, paths, git): see **`rag-server/setup/setup.txt`**.
