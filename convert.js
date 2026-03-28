#!/usr/bin/env node
// wa-to-md/convert.js — World Anvil JSON → Markdown
// Usage: node convert.js <input_dir> <output_dir>

const fs = require("fs");
const path = require("path");

// ─── BBCode → Markdown ────────────────────────────────────────────────────────

function convertBBCode(input) {
  if (!input) return "";
  let out = input;

  // Liens inter-articles WA : @[Titre](type:uuid) → [[Titre]]
  out = out.replace(/@\[([^\]]+)\]\([^)]+\)/g, "[[$1]]");

  // Liens externes WA avec pipe : [url:https://...|tab]texte[/url] → [texte](url)
  out = out.replace(/\[url:([^|\]]+)\|[^\]]*\]([\s\S]*?)\[\/url\]/g, "[$2]($1)");
  // Liens externes WA sans pipe : [url:https://...]texte[/url] → [texte](url)
  out = out.replace(/\[url:([^\]]+)\]([\s\S]*?)\[\/url\]/g, "[$2]($1)");

  // Blocs [aloud] → blockquote Markdown
  out = out.replace(/\[aloud\]([\s\S]*?)\[\/aloud\]/g, function(_, inner) {
    return inner.trim().split("\n").map(function(l) { return "> " + l; }).join("\n");
  });

  // Titres
  out = out.replace(/\[h1\](.*?)\[\/h1\]/g, "\n# $1\n");
  out = out.replace(/\[h2\](.*?)\[\/h2\]/g, "\n## $1\n");
  out = out.replace(/\[h3\](.*?)\[\/h3\]/g, "\n### $1\n");
  out = out.replace(/\[h4\](.*?)\[\/h4\]/g, "\n#### $1\n");

  // Formatage inline
  out = out.replace(/\[b\]([\s\S]*?)\[\/b\]/g, "**$1**");
  out = out.replace(/\[i\]([\s\S]*?)\[\/i\]/g,  "*$1*");
  out = out.replace(/\[u\]([\s\S]*?)\[\/u\]/g,  "$1");
  out = out.replace(/\[s\]([\s\S]*?)\[\/s\]/g,  "~~$1~~");
  out = out.replace(/\[small\]([\s\S]*?)\[\/small\]/g, "*$1*");
  out = out.replace(/\[sup\]([\s\S]*?)\[\/sup\]/g, "^$1^");

  // Paragraphes
  out = out.replace(/\[p\]([\s\S]*?)\[\/p\]/g, "\n$1\n");

  // Listes
  out = out.replace(/\[ul\]([\s\S]*?)\[\/ul\]/g, "$1");
  out = out.replace(/\[ol\]([\s\S]*?)\[\/ol\]/g, "$1");
  out = out.replace(/\[li\]([\s\S]*?)\[\/li\]/g, "- $1");

  // Balises résiduelles — préserve les wikilinks [[...]]
  // Supprime [balise] mais pas [[wikilink]]
  out = out.replace(/(?<!\[)\[(?!\[)[^\]]+\](?!\])/g, "");

  // Nettoyage : \r\n → \n, triple sauts → double
  out = out.replace(/\r\n/g, "\n");
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

// ─── Champs structurés par type de template ───────────────────────────────────

const PERSON_FIELDS = {
  motivation:          "Motivation",
  speech:              "Élocution",
  languages:           "Langues",
  rpgAlignment:        "Alignement",
  currentstatus:       "Statut actuel",
  history:             "Histoire",
  education:           "Formation",
  quotes:              "Citations",
  savviesIneptitudes:  "Points forts / faibles",
  likesDislikes:       "Goûts",
  virtues:             "Vertus",
  vices:               "Vices",
  quirksPersonality:   "Particularités",
  mannerisms:          "Manières",
  hobbies:             "Passe-temps",
  wealth:              "Richesse",
  morality:            "Moralité",
  taboos:              "Tabous",
  goals:               "Objectifs",
};

const PLOT_FIELDS = {
  goals:       "Objectifs",
  threats:     "Menaces",
  locations:   "Lieux",
  encounters:  "Rencontres",
  pastevents:  "Événements passés",
};

function extractStructuredFields(data, fieldMap) {
  const sections = [];
  for (const [key, label] of Object.entries(fieldMap)) {
    const val = data[key];
    if (!val || val === "") continue;
    const converted = convertBBCode(String(val));
    if (converted.trim()) {
      sections.push("## " + label + "\n\n" + converted);
    }
  }
  return sections.join("\n\n");
}

// ─── Relations ────────────────────────────────────────────────────────────────

function formatRelations(label, items) {
  if (!items || items.length === 0) return "";
  const links = items.map(function(r) { return "- [[" + r.title + "]]"; }).join("\n");
  return "### " + label + "\n\n" + links;
}

// ─── Frontmatter YAML ─────────────────────────────────────────────────────────

function buildFrontmatter(data) {
  const lines = ["---"];
  const esc = function(s) { return String(s).replace(/"/g, '\\"'); };

  lines.push('title: "' + esc(data.title || "") + '"');
  lines.push('id: "' + (data.id || "") + '"');
  lines.push('type: "' + (data.entityClass || "") + '"');
  lines.push('template: "' + (data.templateType || "") + '"');
  lines.push('state: "' + (data.state || "") + '"');
  lines.push('wip: ' + (data.isWip || false));
  lines.push('draft: ' + (data.isDraft || false));

  if (data.creationDate && data.creationDate.date)
    lines.push('created: "' + data.creationDate.date.split(" ")[0] + '"');
  if (data.updateDate && data.updateDate.date)
    lines.push('updated: "' + data.updateDate.date.split(" ")[0] + '"');
  if (data.tags)
    lines.push('tags: [' + data.tags + ']');
  if (data.category && data.category.title)
    lines.push('category: "' + esc(data.category.title) + '"');
  if (data.world && data.world.title)
    lines.push('world: "' + esc(data.world.title) + '"');
  if (data.url)
    lines.push('wa_url: "' + data.url + '"');

  // Champs spécifiques Person
  if (data.rpgAlignment) lines.push('alignment: "' + esc(data.rpgAlignment) + '"');
  if (data.sex)          lines.push('sex: "' + data.sex + '"');
  if (data.species && data.species.title)
    lines.push('species: "' + esc(data.species.title) + '"');
  if (data.ethnicity && data.ethnicity.title)
    lines.push('ethnicity: "' + esc(data.ethnicity.title) + '"');
  if (data.organization && data.organization.title)
    lines.push('organization: "[[' + data.organization.title + ']]"');

  // Champs spécifiques Plot
  if (data.parent && data.parent.title)
    lines.push('parent: "[[' + data.parent.title + ']]"');

  lines.push("---");
  return lines.join("\n");
}

// ─── Conversion d'un article ──────────────────────────────────────────────────

function convertArticle(data) {
  const parts = [];

  parts.push(buildFrontmatter(data));
  parts.push("");
  parts.push("# " + data.title);
  parts.push("");

  if (data.content) {
    parts.push(convertBBCode(data.content));
    parts.push("");
  }

  // Champs structurés selon le template
  const template = data.templateType || "";
  let structured = "";
  if (template === "person") {
    structured = extractStructuredFields(data, PERSON_FIELDS);
  } else if (template === "plot") {
    structured = extractStructuredFields(data, PLOT_FIELDS);
  } else {
    // Générique : on essaie les deux
    const merged = Object.assign({}, PERSON_FIELDS, PLOT_FIELDS);
    structured = extractStructuredFields(data, merged);
  }
  if (structured) {
    parts.push(structured);
    parts.push("");
  }

  // Section Relations
  const relSections = [];
  if (data.relatedpeople && data.relatedpeople.length)
    relSections.push(formatRelations("Personnages liés", data.relatedpeople));
  if (data.relatedlocations && data.relatedlocations.length)
    relSections.push(formatRelations("Lieux liés", data.relatedlocations));
  if (data.relatedorganizations && data.relatedorganizations.length)
    relSections.push(formatRelations("Organisations liées", data.relatedorganizations));
  if (data.reports && data.reports.length)
    relSections.push(formatRelations("Rapports de session", data.reports));

  if (relSections.length > 0) {
    parts.push("---\n");
    parts.push("## Relations\n");
    parts.push(relSections.join("\n\n"));
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

// ─── Utilitaires fichiers ─────────────────────────────────────────────────────

function slugify(title) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s\-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .substring(0, 80);
}

function collectJsonFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...collectJsonFiles(full));
    else if (entry.name.endsWith(".json")) results.push(full);
  }
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node convert.js <input_dir> <output_dir>");
    console.error("  input_dir  : dossier contenant les JSON World Anvil");
    console.error("  output_dir : dossier de sortie pour les fichiers Markdown");
    process.exit(1);
  }

  const inputDir  = path.resolve(args[0]);
  const outputDir = path.resolve(args[1]);

  if (!fs.existsSync(inputDir)) {
    console.error("Dossier introuvable : " + inputDir);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const files = collectJsonFiles(inputDir);
  let converted = 0, skipped = 0;

  for (const filePath of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.warn("⚠️  Parse error : " + path.basename(filePath));
      skipped++;
      continue;
    }

    if (!data.title || !data.entityClass) {
      console.warn("⚠️  Structure invalide : " + path.basename(filePath));
      skipped++;
      continue;
    }

    const markdown = convertArticle(data);
    const typeDir  = path.join(outputDir, data.entityClass.toLowerCase() + "s");
    fs.mkdirSync(typeDir, { recursive: true });

    const outFile = path.join(typeDir, slugify(data.title) + ".md");
    fs.writeFileSync(outFile, markdown, "utf-8");
    console.log("✅  " + data.entityClass.padEnd(14) + " " + data.title);
    converted++;
  }

  console.log("\n📦 Terminé : " + converted + " convertis, " + skipped + " ignorés.");
}

main();
