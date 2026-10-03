import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build } from "./build.ts";

const root = path.resolve(import.meta.dirname, "..");

function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

let fileValues: Record<string, string> = {};
try {
  fileValues = parseEnv(await readFile(path.join(root, ".env"), "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const apiKey = fileValues.AMO_JWT_ISSUER || process.env.AMO_JWT_ISSUER;
const apiSecret = fileValues.AMO_JWT_SECRET || process.env.AMO_JWT_SECRET;
if (!apiKey || !apiSecret) {
  console.error("Add AMO_JWT_ISSUER and AMO_JWT_SECRET to .env, then run bun run sign.");
  console.error("Create the key at https://addons.mozilla.org/developers/addon/api/key/");
  process.exit(1);
}

await build();

await new Promise<void>((resolve, reject) => {
  const child = spawn(
    "bunx",
    [
      "--bun",
      "web-ext",
      "sign",
      "--channel=unlisted",
      "--source-dir",
      "dist",
      "--artifacts-dir",
      "web-ext-artifacts",
      "--api-key",
      apiKey,
      "--api-secret",
      apiSecret
    ],
    { cwd: root, stdio: "inherit" }
  );
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`web-ext sign exited ${code}`));
  });
});
