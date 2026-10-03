import { spawn } from "node:child_process";
import path from "node:path";
import { build } from "./build.ts";

const root = path.resolve(import.meta.dirname, "..");
const xpi = path.join(root, "pearpass-firefox-2.1.0.xpi");

await build();

await new Promise<void>((resolve, reject) => {
  const child = spawn("zip", ["-r", "-FS", xpi, "."], { cwd: path.join(root, "dist"), stdio: "inherit" });
  child.on("error", reject);
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`zip exited ${code}`));
  });
});

console.log(`Packed ${xpi}`);
