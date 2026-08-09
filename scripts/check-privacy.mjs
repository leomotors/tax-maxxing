#!/usr/bin/env node
/**
 * Fail CI if committed content looks like personal tax / PII data.
 * Synthetic fixtures (STOCKA/STOCKB, round demo IDs) are allowed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const SKIP_PATH =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|\.git\/|node_modules\/|\.next\/|out\/|coverage\/|scripts\/check-privacy\.mjs)$/;

/** Common SET / fund tickers — deny in repo content (use STOCKA/STOCKB instead). */
const REAL_SYMBOLS = [
  "PTT",
  "PTTEP",
  "AOT",
  "CPALL",
  "CPAXT",
  "KBANK",
  "KTB",
  "SCB",
  "SCBT",
  "BBL",
  "BAY",
  "DELTA",
  "ADVANC",
  "TRUE",
  "INTUCH",
  "GULF",
  "GPSC",
  "EA",
  "HMPRO",
  "BH",
  "BDMS",
  "MINT",
  "CRC",
  "OR",
  "TOP",
  "IVL",
  "TISCO",
  "KKP",
  "MTC",
  "SAWAD",
  "COM7",
  "JMART",
  "JMT",
];

const RULES = [
  {
    id: "home-path",
    re: /\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|\\Users\\[A-Za-z0-9._-]+/g,
    message: "absolute home-directory path",
  },
  {
    id: "downloads",
    re: /\/Downloads\/|\\Downloads\\/gi,
    message: "Downloads path (may encode IDs in filenames)",
  },
  {
    id: "personal-email",
    re: /[A-Za-z0-9._%+-]+@(gmail|googlemail|hotmail|outlook|yahoo|icloud|me|proton\.?me)\.[A-Za-z]{2,}/gi,
    message: "personal email address",
  },
  {
    id: "citizen-or-tax-id",
    // 13-digit Thai-style IDs; allow synthetic 010000000000x used in fixtures
    re: /\b(?!010000000000[01]\b)\d{13}\b/g,
    message: "13-digit ID (citizen/tax) — use synthetic 0100000000000/1 in fixtures",
  },
  {
    id: "real-symbol",
    re: new RegExp(`\\b(?:${REAL_SYMBOLS.join("|")})\\b`, "g"),
    message: "real stock/fund symbol — use STOCKA/STOCKB only",
  },
];

function listedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" });
  return out
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((f) => !SKIP_PATH.test(f));
}

function isProbablyBinary(buf) {
  const sample = buf.subarray(0, Math.min(buf.length, 8000));
  return sample.includes(0);
}

/** Allow documenting forbidden patterns in privacy policy files. */
function isPolicyDoc(file) {
  return /(^|\/)(AGENTS\.md|CLAUDE\.md|README\.md|CHANGELOG\.md)$/.test(file);
}

const findings = [];

for (const file of listedFiles()) {
  const abs = path.join(ROOT, file);
  let buf;
  try {
    buf = readFileSync(abs);
  } catch {
    continue;
  }
  if (isProbablyBinary(buf)) {
    if (/\.(xlsx|xls|csv|pdf|png|jpe?g|zip)$/i.test(file)) {
      findings.push({ file, id: "binary-export", message: "binary/export file should not be committed" });
    }
    continue;
  }
  const text = buf.toString("utf8");
  if (isPolicyDoc(file)) continue;

  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    const matches = text.match(rule.re);
    if (!matches?.length) continue;
    const sample = [...new Set(matches)].slice(0, 5).join(", ");
    findings.push({
      file,
      id: rule.id,
      message: `${rule.message} (${sample})`,
    });
  }
}

if (findings.length === 0) {
  console.log("Privacy check passed — no PII / personal tax data patterns in tracked files.");
  process.exit(0);
}

console.error("Privacy check FAILED — possible personal data in tracked files:\n");
for (const f of findings) {
  console.error(`- [${f.id}] ${f.file}: ${f.message}`);
}
console.error("\nSee AGENTS.md → Privacy. Keep real exports under private/ (gitignored).");
process.exit(1);
