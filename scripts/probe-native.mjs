import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const host = path.join(os.homedir(), ".config", "PearPass", "native-messaging", "pearpass-native-host.sh");

function frame(message) {
  const json = JSON.stringify(message);
  const wrapped = { length: Buffer.byteLength(json), message };
  const body = Buffer.from(JSON.stringify(wrapped));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

function readMessages(child, ms) {
  return new Promise((resolve) => {
    const chunks = [];
    const done = (reason) => resolve({ reason, chunks: Buffer.concat(chunks) });
    const timer = setTimeout(() => done("timeout"), ms);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(Buffer.from(`\nSTDERR:${chunk.toString()}\n`)));
    child.on("exit", (code) => {
      clearTimeout(timer);
      done(`exit:${code}`);
    });
  });
}

function parseFrames(buffer) {
  const messages = [];
  let offset = 0;
  const textNotes = [];
  const raw = buffer.toString("utf8");
  const stderrAt = raw.indexOf("\nSTDERR:");
  const binary = stderrAt === -1 ? buffer : buffer.subarray(0, Buffer.from(raw.slice(0, stderrAt)).length);
  if (stderrAt !== -1) textNotes.push(raw.slice(stderrAt + 1, stderrAt + 500));
  while (offset + 4 <= binary.length) {
    const length = binary.readUInt32LE(offset);
    if (length <= 0 || length > 1024 * 1024 || offset + 4 + length > binary.length) break;
    const json = binary.subarray(offset + 4, offset + 4 + length).toString("utf8");
    messages.push(JSON.parse(json));
    offset += 4 + length;
  }
  return { messages, textNotes, unread: binary.length - offset };
}

const child = spawn(host, { stdio: ["pipe", "pipe", "pipe"] });
child.stdin.write(frame({ id: 1, command: "checkAvailability", params: {} }));
const result = await readMessages(child, 8000);
child.kill("SIGTERM");
const parsed = parseFrames(result.chunks);
const summary = parsed.messages.map((message) => {
  const inner = message.message ?? message;
  const availability = inner.result ?? inner;
  return {
    success: inner.success,
    available: availability.available,
    status: availability.status,
    message: availability.message,
    error: inner.error
  };
});
console.log(JSON.stringify({ reason: result.reason, summary, notes: parsed.textNotes, unread: parsed.unread }, null, 2));
if (!summary.some((item) => item.available === true)) process.exit(1);
