import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "bun:test";
import { build, rewriteExtensionHtml } from "../scripts/build.ts";

const root = path.resolve(import.meta.dirname, "..");

describe("extension page html", () => {
  test("drops crossorigin and root-absolute urls", () => {
    const html = `<script type="module" crossorigin src="/action.js"></script>
<link rel="modulepreload" crossorigin href="/assets/strict.js">
<link rel="stylesheet" crossorigin href="/assets/strict.css">`;
    const rewritten = rewriteExtensionHtml(html);
    expect(rewritten).not.toContain("crossorigin");
    expect(rewritten).toContain('src="action.js"');
    expect(rewritten).toContain('href="assets/strict.js"');
    expect(rewritten).toContain('href="assets/strict.css"');
  });
});

describe("firefox build", () => {
  test("writes a gecko manifest without chrome-only permissions", async () => {
    const dist = await build();
    const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
    expect(manifest.browser_specific_settings.gecko.id).toBe("pearpass-firefox@anujkp.dev");
    expect(manifest.browser_specific_settings.gecko.data_collection_permissions.required).toEqual([
      "authenticationInfo",
      "websiteContent"
    ]);
    expect(manifest.icons["16"]).toBe("icon-16.png");
    expect(manifest.permissions).not.toContain("offscreen");
    expect(manifest.background.scripts).toEqual(["background.js"]);
    expect(manifest.background.service_worker).toBeUndefined();
    expect(manifest.content_scripts[0]).toMatchObject({
      js: ["inject.js"],
      run_at: "document_start",
      world: "MAIN"
    });

    const popup = await readFile(path.join(dist, "index.html"), "utf8");
    expect(popup).toContain('src="action.js"');
    expect(popup).not.toContain("crossorigin");
    expect(popup).not.toContain('src="/');

    const background = await readFile(path.join(dist, "background.js"), "utf8");
    expect(background).toContain('document.execCommand("copy")');
    expect(background).not.toContain("chrome.offscreen");

    const host = await readFile(path.join(root, "native", "pearpass-native-host.sh"), "utf8");
    expect(host).toContain("native-messaging-bridge.bundle.cjs");
    expect(host).toContain("ELECTRON_RUN_AS_NODE");
  });
});
