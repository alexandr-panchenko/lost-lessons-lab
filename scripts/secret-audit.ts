import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const binaryExtensions = new Set([
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
  ".zip",
]);
const leakedValuePatterns = [
  { label: "OpenAI-style key", pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/u },
  {
    label: "private key block",
    pattern: /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----/u,
  },
  {
    label: "room capability URL",
    pattern: /#token=(?!(?:CAPABILITY|invalid-|\$\{))[A-Za-z0-9_-]{32,}/u,
  },
] as const;
const clientOnlyForbiddenMarkers = [
  "CLOUDFLARE_API_TOKEN",
  "OPENAI_API_KEY",
  "ROOM_TOKEN_PEPPER",
] as const;

async function runGit(args: string[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const process = spawn("git", args, {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    process.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    process.stderr.resume();
    process.on("error", () =>
      reject(new Error("Secret audit Git read failed")),
    );
    process.on("close", (code) => {
      if (code !== 0) {
        reject(new Error("Secret audit Git read failed"));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

async function filesBelow(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function hasBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.byteLength === 0 || needle.byteLength > haystack.byteLength)
    return false;
  outer: for (
    let start = 0;
    start <= haystack.byteLength - needle.byteLength;
    start += 1
  ) {
    for (let offset = 0; offset < needle.byteLength; offset += 1) {
      if (haystack[start + offset] !== needle[offset]) continue outer;
    }
    return true;
  }
  return false;
}

async function localSecretValues(): Promise<string[]> {
  try {
    const source = await readFile(join(root, ".dev.vars"), "utf8");
    return source
      .split(/\r?\n/u)
      .map(
        (line) =>
          line.match(
            /^\s*(?:CLOUDFLARE_API_TOKEN|OPENAI_API_KEY|ROOM_TOKEN_PEPPER)\s*=\s*(.+?)\s*$/u,
          )?.[1],
      )
      .filter((value): value is string => value !== undefined)
      .map((value) => value.replace(/^["']|["']$/gu, ""))
      .filter((value) => value.length >= 8 && value !== "replace-me");
  } catch {
    return [];
  }
}

const trackedOutput = await runGit(["ls-files", "-z"]);
const trackedFiles = new TextDecoder()
  .decode(trackedOutput)
  .split("\0")
  .filter(Boolean);
const buildFiles = await filesBelow(join(root, "dist"));
const scanFiles = [
  ...trackedFiles.map((path) => join(root, path)),
  ...buildFiles,
];
const localSecrets = await localSecretValues();
const failures = new Set<string>();

for (const path of scanFiles) {
  const bytes = new Uint8Array(await readFile(path));
  const displayPath = relative(root, path);
  for (const secret of localSecrets) {
    if (hasBytes(bytes, new TextEncoder().encode(secret)))
      failures.add(`${displayPath}: local secret value`);
  }
  if (binaryExtensions.has(extname(path).toLowerCase())) continue;
  const text = new TextDecoder().decode(bytes);
  for (const candidate of leakedValuePatterns) {
    if (candidate.pattern.test(text))
      failures.add(`${displayPath}: ${candidate.label}`);
  }
  for (const line of text.split(/\r?\n/u)) {
    const assignment = line.match(
      /^\s*(?:export\s+)?(?:CLOUDFLARE_API_TOKEN|OPENAI_API_KEY|ROOM_TOKEN_PEPPER)\s*=\s*(.+?)\s*$/u,
    )?.[1];
    if (
      assignment !== undefined &&
      !/^(?:["']?\.{3}["']?|["']?<|["']?replace-|\$|\*{3})/u.test(assignment)
    ) {
      failures.add(`${displayPath}: concrete secret assignment`);
    }
  }
}

const history = await runGit([
  "log",
  "--all",
  "--no-ext-diff",
  "--format=",
  "-p",
  "--",
  ".",
  ":(exclude)docs/evidence/*.png",
]);
const historyText = new TextDecoder().decode(history);
for (const candidate of leakedValuePatterns) {
  if (candidate.pattern.test(historyText))
    failures.add(`Git history: ${candidate.label}`);
}
for (const secret of localSecrets) {
  if (hasBytes(history, new TextEncoder().encode(secret)))
    failures.add("Git history: local secret value");
}

const clientFiles = buildFiles.filter((path) =>
  relative(root, path).startsWith("dist/client/"),
);
for (const path of clientFiles) {
  if (path.endsWith(".map"))
    failures.add(`${relative(root, path)}: source map`);
  if (binaryExtensions.has(extname(path).toLowerCase())) continue;
  const text = await readFile(path, "utf8");
  for (const marker of clientOnlyForbiddenMarkers) {
    if (text.includes(marker))
      failures.add(`${relative(root, path)}: server secret marker`);
  }
}

if (failures.size > 0) {
  throw new Error(`Secret audit failed:\n${[...failures].sort().join("\n")}`);
}

console.info(
  JSON.stringify({
    buildFiles: buildFiles.length,
    clientSourceMaps: 0,
    history: "scanned-without-secret-values",
    localSecretValuesChecked: localSecrets.length,
    status: "secret-audit-passed",
    trackedFiles: trackedFiles.length,
  }),
);
