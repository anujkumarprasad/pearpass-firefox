import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const vendor = path.join(root, "vendor", "chrome");
const dist = path.join(root, "dist");

const htmlFiles = ["index.html", "content-popups.html", "onboarding.html", "offscreen.html"];

const chromeClipboardBranch =
  'const To=async()=>{try{return await chrome.offscreen.hasDocument()||await chrome.offscreen.createDocument({url:ot.getURL("offscreen.html"),reasons:["CLIPBOARD"],justification:"Clear clipboard contents after timeout."}),!0}catch(t){return O.error("[Clipboard] Failed to create offscreen document",t),!1}},bo=async()=>{if(typeof chrome.offscreen<"u"){if(!await To()){O.error("[Clipboard] Failed to ensure offscreen document for alarm");return}ot.sendMessage({type:No});return}try{await navigator.clipboard.writeText(" ")}catch(t){O.error("[Clipboard] Failed to clear clipboard via navigator API",t)}}';

const firefoxClipboardBranch =
  'const To=async()=>!1,bo=async()=>{const t=" ";try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(t);return}}catch(e){}try{const e=document.createElement("textarea");e.value=t;e.setAttribute("readonly","");e.style.position="fixed";e.style.left="-9999px";(document.documentElement||document.body).appendChild(e);e.focus();e.select();const n=document.execCommand("copy");e.remove();if(!n)throw new Error("execCommand copy failed")}catch(e){O.error("[Clipboard] Failed to clear clipboard",e)}}';

/**
 * Chrome clears the clipboard from an offscreen document. Firefox has no
 * offscreen API, and a background script does not receive its own
 * runtime.sendMessage, so the clear has to run in this event page.
 */
export function patchBackgroundForFirefox(source: string): string {
  const patched = source.replaceAll(chromeClipboardBranch, firefoxClipboardBranch);
  if (patched === source || patched.includes("chrome.offscreen")) {
    throw new Error("Could not remove the Chrome offscreen clipboard path");
  }
  return patched;
}

/** Extension pages in Firefox fail module loads when script/link tags are cross-origin. */
export function rewriteExtensionHtml(html: string): string {
  return html
    .replace(/\s+crossorigin(?:="[^"]*")?/g, "")
    .replace(/(src|href)="\/([^"]+)"/g, '$1="$2"');
}

export async function build(): Promise<string> {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(vendor, dist, { recursive: true });
  await cp(path.join(root, "firefox", "manifest.json"), path.join(dist, "manifest.json"));
  const backgroundPath = path.join(dist, "background.js");
  await writeFile(backgroundPath, patchBackgroundForFirefox(await readFile(backgroundPath, "utf8")));
  await writeIcons(path.join(vendor, "icon.png"), dist);

  for (const name of htmlFiles) {
    const file = path.join(dist, name);
    const html = await readFile(file, "utf8");
    await writeFile(file, rewriteExtensionHtml(html));
  }

  const names = await readdir(dist);
  if (!names.includes("background.js")) {
    throw new Error("Firefox build is missing background.js");
  }
  return dist;
}

function writeIcons(source: string, outputDir: string): Promise<void> {
  const script = `
from PIL import Image
source, output = ${JSON.stringify(source)}, ${JSON.stringify(outputDir)}
image = Image.open(source).convert("RGBA")
for size in (16, 48, 128):
    image.resize((size, size), Image.Resampling.LANCZOS).save(f"{output}/icon-{size}.png")
`;
  return new Promise((resolve, reject) => {
    const child = spawn("python3", ["-c", script], { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`icon resize exited ${code}`));
    });
  });
}

if (import.meta.main) {
  const output = await build();
  console.log(`Built Firefox extension at ${output}`);
}
