// Regression guard: verifies that every menu item in TopBar is either handled by
// TopBar itself or has a matching `case "..."` in App.tsx. This protects against
// the class of bug seen with `"New Layer..."` (the menu label differs from the case
// label, so it silently falls through to `default`).
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const topbar = readFileSync(path.join(root, "src/components/TopBar.tsx"), "utf8");
const app = readFileSync(path.join(root, "src/App.tsx"), "utf8");

// Items that TopBar.handleMenuAction handles directly (they never reach App).
// Derived automatically from the switch cases inside TopBar itself, so they do not
// go stale when it is edited.
const handledInTopBar = new Set([...topbar.matchAll(/case "([^"]+)":/g)].map((m) => m[1]));

const menuItems = new Set();
for (const block of topbar.matchAll(/items:\s*\[([\s\S]*?)\]/g)) {
  for (const m of block[1].matchAll(/"([^"]+)"/g)) {
    if (m[1] !== "—") menuItems.add(m[1]);
  }
}

const appCases = new Set([...app.matchAll(/case "([^"]+)":/g)].map((m) => m[1]));

// Normalized comparison: unifies the U+2026 character with "..." before checking, so
// matching does not fail because of an invisible character (the root cause of the
// "New Layer..." bug).
const norm = (s) => s.replace(/\u2026/g, "...").trim();
const handledInTopBarNorm = new Set([...handledInTopBar].map(norm));
const appCasesNorm = new Set([...appCases].map(norm));

const dead = [...menuItems]
  .filter((item) => !handledInTopBarNorm.has(norm(item)) && !appCasesNorm.has(norm(item)))
  .sort();

if (dead.length > 0) {
  console.log("✗ menu items with no handler (dead buttons):");
  for (const d of dead) {
    const near = [...appCases].filter((c) => norm(c) === norm(d));
    const hint = near.length > 0
      ? `  ← a similar case exists "${near[0]}" but differs by an invisible character`
      : "";
    console.log(`   - "${d}"${hint}`);
  }
  process.exit(1);
}
console.log(`✓ all menu items (${menuItems.size}) are handled (TopBar: ${handledInTopBar.size}, App cases: ${appCases.size}).`);
