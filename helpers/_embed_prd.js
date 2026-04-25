// _embed_prd.js — render PROJECT-PRD.md into HTML and insert as a new
// <details> section in the runbook, right above the Changelog block.
//
// Usage (run from Blueprint Tasks/):
//   node helpers/_embed_prd.js
//
// Custom mini-markdown converter — only handles the subset of markdown
// used in PROJECT-PRD.md (headings, lists, tables, blockquotes, hr,
// inline bold/italic/code, fenced code blocks, task-list checkboxes).
// Not a general-purpose md→html.

const fs = require("fs");

const MD = "history/PROJECT-PRD.md";
const HTML = "pcblueprint-checklist_25 april.html";

const md = fs.readFileSync(MD, "utf8");

// ── Markdown → HTML ────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  let r = escapeHtml(s);
  // Task-list checkboxes — convert "[ ]" / "[x]" / "[X]" to Unicode boxes.
  r = r.replace(/\[ \]/g, "☐").replace(/\[[xX]\]/g, "☑");
  // Code spans first (so * inside ` is left alone).
  r = r.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Bold then italic.
  r = r.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  r = r.replace(/\*([^*\s][^*]*?)\*/g, "<em>$1</em>");
  return r;
}

function mdToHtml(src) {
  const lines = src.split("\n");
  const out = [];
  let inCodeBlock = false;
  let codeBuffer = [];
  let inList = null; // "ul" | "ol" | null
  let inTable = false;
  let tableSepSeen = false;

  function closeList() {
    if (inList) { out.push(`</${inList}>`); inList = null; }
  }
  function closeTable() {
    if (inTable) { out.push("</tbody></table>"); inTable = false; tableSepSeen = false; }
  }

  for (const raw of lines) {
    const line = raw;

    // Fenced code block
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push(`<pre style="background: var(--bg-elevated); padding: 12px; border-radius: 6px; overflow-x: auto;"><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        closeList(); closeTable();
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) { codeBuffer.push(line); continue; }

    // Headings
    let m;
    if ((m = line.match(/^#### (.+)$/))) {
      closeList(); closeTable();
      out.push(`<h4 style="margin: 16px 0 6px;">${inline(m[1])}</h4>`); continue;
    }
    if ((m = line.match(/^### (.+)$/))) {
      closeList(); closeTable();
      out.push(`<h3 style="margin: 18px 0 8px;">${inline(m[1])}</h3>`); continue;
    }
    if ((m = line.match(/^## (.+)$/))) {
      closeList(); closeTable();
      out.push(`<h2 style="margin: 24px 0 10px; padding-top: 8px; border-top: 1px solid var(--border);">${inline(m[1])}</h2>`); continue;
    }
    if ((m = line.match(/^# (.+)$/))) {
      closeList(); closeTable();
      const title = m[1];
      const slug = "prd-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      const isEpic = /^EPIC \d+|^pcblueprint|^Cross-cutting|^Sequencing/i.test(title);
      out.push(`<h1 id="${slug}" data-anchor data-anchor-label="${escapeHtml(title)}" style="margin: 28px 0 12px; font-size: 1.4em;">${inline(title)}</h1>`);
      continue;
    }

    // HR
    if (/^---+\s*$/.test(line)) {
      closeList(); closeTable();
      out.push(`<hr style="border: 0; border-top: 1px solid var(--border); margin: 18px 0;">`); continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      closeList(); closeTable();
      out.push(`<blockquote style="border-left: 3px solid var(--accent); margin: 8px 0; padding: 4px 12px; color: var(--text-faint);">${inline(line.slice(2))}</blockquote>`);
      continue;
    }

    // Table row
    if (/^\|.*\|/.test(line)) {
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      const isSeparator = cells.every(c => /^:?-+:?$/.test(c));
      if (!inTable) {
        closeList();
        out.push(`<table style="border-collapse: collapse; margin: 10px 0; width: 100%;"><thead><tr>`);
        cells.forEach(c => out.push(`<th style="border: 1px solid var(--border); padding: 6px 10px; text-align: left;">${inline(c)}</th>`));
        out.push(`</tr></thead><tbody>`);
        inTable = true;
        tableSepSeen = false;
      } else if (!tableSepSeen && isSeparator) {
        tableSepSeen = true;
      } else {
        out.push(`<tr>`);
        cells.forEach(c => out.push(`<td style="border: 1px solid var(--border); padding: 6px 10px; vertical-align: top;">${inline(c)}</td>`));
        out.push(`</tr>`);
      }
      continue;
    }

    // Bullet list
    if (/^- /.test(line)) {
      closeTable();
      if (inList !== "ul") { closeList(); out.push(`<ul style="margin: 4px 0 8px 22px; padding: 0;">`); inList = "ul"; }
      out.push(`<li style="margin: 3px 0;">${inline(line.slice(2))}</li>`);
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      closeTable();
      if (inList !== "ol") { closeList(); out.push(`<ol style="margin: 4px 0 8px 22px; padding: 0;">`); inList = "ol"; }
      out.push(`<li style="margin: 3px 0;">${inline(line.replace(/^\d+\. /, ""))}</li>`);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      closeList(); closeTable();
      out.push("");
      continue;
    }

    // Paragraph
    closeList(); closeTable();
    out.push(`<p style="margin: 6px 0;">${inline(line)}</p>`);
  }

  closeList(); closeTable();
  return out.join("\n");
}

const renderedPrd = mdToHtml(md);

// ── Wrap as <section class="pane has-nav"> + insert into the PRD pane ──────

const prdPane = `<section class="pane has-nav" data-pane="prd" hidden>
    <aside class="pane-nav" data-nav="prd"></aside>
    <div class="pane-content">
${renderedPrd}
    </div>
  </section>`;

let html = fs.readFileSync(HTML, "utf8");

// Find the PRD pane placeholder/existing and replace its body. The pane is
// always present in the new tabbed structure (see runbook HTML); this script
// only refreshes its inner content.
const paneRegex = /<section class="pane[^"]*" data-pane="prd"[^>]*>[\s\S]*?<\/section>/;
if (!paneRegex.test(html)) {
  throw new Error(
    'PRD pane not found. Expected <section class="pane..." data-pane="prd"...>...</section> in the HTML. ' +
    'Run the tab-structure migration first (or fall back to an older _embed_prd.js if you reverted the tabs).'
  );
}

html = html.replace(paneRegex, prdPane);
fs.writeFileSync(HTML, html, "utf8");
console.log(`Refreshed PRD pane in ${HTML}`);
