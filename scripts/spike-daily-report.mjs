import { chromium } from "playwright";
import { access, mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCookieJar, profileDir, saveCookieJar } from "../src/session.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratchDir = path.join(root, ".scratch");
const origin = process.env.BLUESURF_ORIGIN ?? "https://surf.bluepeople.com";

await mkdir(scratchDir, { recursive: true });

const calls = [];

const skipTypes = new Set(["stylesheet", "script", "font"]);

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|map)(\?|$)/i.test(url);
}

function shouldRecord(url, resourceType) {
  if (!url.startsWith(origin)) return false;
  if (isStaticAsset(url)) return false;
  if (skipTypes.has(resourceType)) return false;
  return url.includes("/api/");
}

function redact(body) {
  if (typeof body !== "string") return body;
  return body
    .replace(/"(access_token|refresh_token|id_token|token|authorization|password)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .slice(0, 8000);
}

const context = await chromium.launchPersistentContext(profileDir(), {
  headless: false,
  viewport: { width: 1400, height: 900 },
  title: "Blue Surf daily report spike",
});

await loadCookieJar(context);

context.on("response", async (response) => {
  const url = response.url();
  const request = response.request();
  if (!shouldRecord(url, request.resourceType())) return;

  const headers = response.headers();
  const contentType = headers["content-type"] ?? "";
  let body = "";
  if (/json|text|xml|html|javascript/i.test(contentType)) {
    try {
      body = await response.text();
    } catch {
      body = "";
    }
  } else {
    body = `[binary ${contentType}]`;
  }

  calls.push({
    method: request.method(),
    url,
    status: response.status(),
    postData: redact(request.postData() ?? ""),
    responsePreview: redact(body),
  });
});

const page = context.pages()[0] ?? (await context.newPage());
await page.goto(origin, { waitUntil: "domcontentloaded" });

const doneFile = path.join(scratchDir, "daily-report-spike-done");
await unlink(doneFile).catch(() => {});

console.log(`
Daily report network capture — ${origin}

In the Chromium window:
  1. Sign in if needed.
  2. Open Daily Report for any day (e.g. today or yesterday).
  3. Let calendar/events load if the UI offers them.
  4. Add or edit at least one ticket activity (project + work item + category).
  5. Click Save only — do NOT Save & Confirm.

When finished, run in a terminal:
  touch ${doneFile}

Or press Enter in this terminal.
`);

await new Promise((resolve) => {
  process.stdin.resume();
  process.stdin.once("data", resolve);
  const timer = setInterval(() => {
    access(doneFile)
      .then(() => {
        clearInterval(timer);
        resolve();
      })
      .catch(() => {});
  }, 500);
});

await saveCookieJar(context);

const out = path.join(scratchDir, "daily-report-network.json");
const interesting = calls.filter((c) =>
  /effort|daily|calendar|categor|workitem|WorkItem/i.test(c.url + c.postData),
);

await writeFile(
  out,
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      origin,
      callCount: calls.length,
      interestingCount: interesting.length,
      interesting,
      calls,
    },
    null,
    2,
  ),
);

await context.close();
console.log(`Wrote ${calls.length} API calls to ${out} (${interesting.length} effort/daily/calendar related).`);
