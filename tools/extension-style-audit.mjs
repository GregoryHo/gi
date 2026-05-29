#!/usr/bin/env node
import { access, readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import process from "node:process";

const PRODUCTION_TS_RE = /\.ts$/;
const TEST_TS_RE = /\.test\.ts$/;
const STRING_LITERAL_UNION_RE = /Type\.Union\s*\(\s*\[[\s\S]*?Type\.Literal\s*\(\s*['"]/m;

export async function auditPackage(packageDirInput) {
  const packageDir = resolve(packageDirInput);
  const packageJson = await readPackageJson(packageDir);
  const srcDir = join(packageDir, "src");
  const productionFiles = (await listFiles(srcDir))
    .filter((file) => PRODUCTION_TS_RE.test(file) && !TEST_TS_RE.test(file))
    .sort();
  const fileSummaries = await Promise.all(productionFiles.map((file) => summarizeFile(srcDir, file)));
  const productionFileCount = productionFiles.length;
  const oversizedFiles = fileSummaries
    .filter((file) => file.lineCount > 500)
    .map((file) => ({ path: file.path, lineCount: file.lineCount, severity: "high" }));
  const indexSummary = fileSummaries.find((file) => file.path === "index.ts");
  const stringEnumLiteralUnionFiles = fileSummaries
    .filter((file) => STRING_LITERAL_UNION_RE.test(file.content))
    .map((file) => file.path);
  const promotionSignals = findPromotionSignals(productionFiles);
  const classification = classifyPackage({ productionFileCount, oversizedFiles, promotionSignals });

  return {
    packageName: packageJson.name ?? relative(process.cwd(), packageDir),
    packageDir,
    classification,
    productionFileCount,
    indexRegistrations: {
      commands: countMatches(indexSummary?.content ?? "", /\.registerCommand\s*\(/g),
      tools: countMatches(indexSummary?.content ?? "", /\.registerTool\s*\(/g),
      events: countMatches(indexSummary?.content ?? "", /\.on\s*\(/g),
    },
    oversizedFiles,
    stringEnumLiteralUnionFiles,
    promotionSignals,
    manifestIssues: findManifestIssues(packageJson),
  };
}

export async function auditRepository(rootDirInput = process.cwd()) {
  const rootDir = resolve(rootDirInput);
  const packagesDir = join(rootDir, "packages");
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const packageDirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = join(packagesDir, entry.name);
    if (await exists(join(candidate, "package.json"))) packageDirs.push(candidate);
  }
  return Promise.all(packageDirs.sort().map(auditPackage));
}

export function formatAuditResults(results) {
  const lines = [];
  for (const result of results) {
    lines.push(`${result.packageName} — ${result.classification} (${result.productionFileCount} production files)`);
    const registrations = result.indexRegistrations;
    lines.push(`  index registrations: commands=${registrations.commands}, tools=${registrations.tools}, events=${registrations.events}`);
    if (result.oversizedFiles.length > 0) {
      lines.push(`  oversized files: ${result.oversizedFiles.map((file) => `${file.path}:${file.lineCount}`).join(", ")}`);
    }
    if (result.stringEnumLiteralUnionFiles.length > 0) {
      lines.push(`  string enum literal unions: ${result.stringEnumLiteralUnionFiles.join(", ")}`);
    }
    if (result.promotionSignals.length > 0) {
      lines.push(`  promotion signals: ${result.promotionSignals.join("; ")}`);
    }
    if (result.manifestIssues.length > 0) {
      lines.push(`  manifest issues: ${result.manifestIssues.join("; ")}`);
    }
  }
  return lines.join("\n");
}

async function readPackageJson(packageDir) {
  const raw = await readFile(join(packageDir, "package.json"), "utf8");
  return JSON.parse(raw);
}

async function listFiles(dir, prefix = "") {
  const currentDir = join(dir, prefix);
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = join(dir, relPath);
    if (entry.isDirectory()) {
      files.push(...await listFiles(dir, relPath));
    } else if (entry.isFile()) {
      files.push(relPath);
    } else if (!entry.isSymbolicLink()) {
      try {
        const stats = await stat(absolutePath);
        if (stats.isFile()) files.push(relPath);
      } catch {
        // Ignore unreadable entries in audit output.
      }
    }
  }
  return files;
}

async function summarizeFile(srcDir, relPath) {
  const content = await readFile(join(srcDir, relPath), "utf8");
  return { path: relPath, content, lineCount: content.split("\n").length };
}

function classifyPackage({ productionFileCount, oversizedFiles, promotionSignals }) {
  if (productionFileCount > 15 || oversizedFiles.some((file) => file.severity === "high") || promotionSignals.length >= 2) {
    return "large";
  }
  if (productionFileCount >= 6 || oversizedFiles.length > 0 || promotionSignals.length === 1) {
    return "medium";
  }
  return "small";
}

function findPromotionSignals(files) {
  const topLevelByPrefix = new Map();
  const folders = new Map();
  for (const file of files) {
    const parts = file.split("/");
    if (parts.length > 1) {
      folders.set(parts[0], (folders.get(parts[0]) ?? 0) + 1);
      continue;
    }
    const stem = file.replace(/\.ts$/, "");
    const prefix = stem.includes("-") ? stem.split("-")[0] : stem;
    if (["index", "types", "config", "commands", "tools"].includes(prefix)) continue;
    topLevelByPrefix.set(prefix, (topLevelByPrefix.get(prefix) ?? 0) + 1);
  }

  const signals = [];
  for (const [prefix, count] of topLevelByPrefix) {
    if (count >= 3) signals.push(`${count} top-level files share '${prefix}-*' responsibility`);
  }
  for (const [folder, count] of folders) {
    if (count >= 3) signals.push(`existing '${folder}/' responsibility cluster has ${count} files`);
  }
  return signals.sort();
}

function findManifestIssues(packageJson) {
  const issues = [];
  if (packageJson.type !== "module") issues.push("type should be module");
  if (packageJson.main !== "src/index.ts") issues.push("main should be src/index.ts");
  if (!packageJson.exports) issues.push("exports should point to ./src/index.ts");
  if (!packageJson.pi?.extensions?.includes("./src/index.ts")) issues.push("pi.extensions should include ./src/index.ts");
  if (!packageJson.keywords?.includes("pi-package")) issues.push("keywords should include pi-package");
  if (!packageJson.keywords?.includes("pi-extension")) issues.push("keywords should include pi-extension");
  for (const scriptName of ["test", "typecheck", "pack:dry-run"]) {
    if (!packageJson.scripts?.[scriptName]) issues.push(`scripts.${scriptName} is missing`);
  }
  if (!packageJson.peerDependencies?.["@earendil-works/pi-coding-agent"]) {
    issues.push("peerDependencies.@earendil-works/pi-coding-agent is missing");
  }
  if (!packageJson.peerDependencies?.typebox) issues.push("peerDependencies.typebox is missing");
  return issues;
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const packageArgIndex = args.indexOf("--package");
  const rootDir = process.cwd();
  const results = packageArgIndex === -1
    ? await auditRepository(rootDir)
    : [await auditPackage(join(rootDir, "packages", args[packageArgIndex + 1] ?? ""))];
  console.log(json ? JSON.stringify(results, null, 2) : formatAuditResults(results));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
