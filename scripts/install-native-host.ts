import { chmod, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const hostPath = path.join(root, "native", "pearpass-native-host.sh");
const manifest = {
  name: "com.pears.pass",
  description: "PearPass Native Messaging Host",
  path: hostPath,
  type: "stdio",
  allowed_extensions: ["pass@pears.com", "pass-nightly@pears.com"]
};

const destinations = [
  path.join(os.homedir(), ".mozilla", "native-messaging-hosts", "com.pears.pass.json"),
  path.join(os.homedir(), "snap", "firefox", "common", ".mozilla", "native-messaging-hosts", "com.pears.pass.json")
];

await chmod(hostPath, 0o755);

for (const destination of destinations) {
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Installed native host manifest at ${destination}`);
}

console.log("Start the PearPass desktop app before using the extension.");
