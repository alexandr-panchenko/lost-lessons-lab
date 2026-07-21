import { readdir, readFile, unlink } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";

const buildRoot = resolve("dist");

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );

  return files.flat();
}

function localSecretCandidates(source: string): string[] {
  return source
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      return {
        key: separator >= 0 ? line.slice(0, separator).trim() : "",
        value: separator >= 0 ? line.slice(separator + 1).trim() : "",
      };
    })
    .filter(({ key }) => /(KEY|TOKEN|SECRET|PEPPER)/u.test(key))
    .map(({ value }) => value)
    .map((value) => value.replace(/^(["'])(.*)\1$/u, "$2"))
    .filter((value) => value.length >= 8);
}

const initialFiles = await filesUnder(buildRoot);
const copiedDevVars = initialFiles.filter((path) =>
  basename(path).startsWith(".dev.vars"),
);

for (const path of copiedDevVars) {
  await unlink(path);
}

const localSecrets = await readFile(resolve(".dev.vars"), "utf8")
  .then(localSecretCandidates)
  .catch(() => []);

const outputFiles = await filesUnder(buildRoot);
for (const path of outputFiles) {
  const output = await readFile(path);
  const text = output.toString("utf8");
  const containsLocalSecret = localSecrets.some((secret) =>
    text.includes(secret),
  );
  const containsApiKeyPattern = /sk-[A-Za-z0-9_-]{20,}/u.test(text);

  if (containsLocalSecret || containsApiKeyPattern) {
    throw new Error(
      `Build output file ${relative(buildRoot, path)} contains a secret value; refusing to continue.`,
    );
  }
}

if (outputFiles.some((path) => basename(path).startsWith(".dev.vars"))) {
  throw new Error(
    "Build output still contains a local development variables file.",
  );
}

console.log("Build output finalized with no local development secrets.");
