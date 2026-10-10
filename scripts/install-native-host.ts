import { access, chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const repoHost = path.join(root, "native", "pearpass-native-host.sh");
const desktopHost = path.join(os.homedir(), ".config", "PearPass", "native-messaging", "pearpass-native-host.sh");

const extensionIds = ["pearpass-firefox@anujkp.dev", "pass@pears.com", "pass-nightly@pears.com"];

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * The desktop app rewrites com.pears.pass.json when Browser Sync is enabled.
 * That copy only allows pass@pears.com and pass-nightly@pears.com, so Firefox
 * refuses to start the host for pearpass-firefox@anujkp.dev and the popup
 * reports "Disconnected from native host". Keep the desktop wrapper when it
 * exists: the app refreshes its mount path on every launch.
 */
async function hostPath(): Promise<string> {
  if (await exists(desktopHost)) return desktopHost;
  return repoHost;
}

async function allowedExtensions(destination: string): Promise<string[]> {
  const ids = new Set(extensionIds);
  try {
    const current = JSON.parse(await readFile(destination, "utf8")) as { allowed_extensions?: string[] };
    for (const id of current.allowed_extensions ?? []) ids.add(id);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return [...ids];
}

const host = await hostPath();
await chmod(repoHost, 0o755);
if (host !== repoHost) await chmod(host, 0o755);

const destinations = [
  path.join(os.homedir(), ".mozilla", "native-messaging-hosts", "com.pears.pass.json"),
  path.join(os.homedir(), "snap", "firefox", "common", ".mozilla", "native-messaging-hosts", "com.pears.pass.json")
];

for (const destination of destinations) {
  await mkdir(path.dirname(destination), { recursive: true });
  const manifest = {
    name: "com.pears.pass",
    description: "PearPass Native Messaging Host",
    path: host,
    type: "stdio",
    allowed_extensions: await allowedExtensions(destination)
  };
  await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Installed native host manifest at ${destination}`);
}

console.log("Start the PearPass desktop app before using the extension.");
