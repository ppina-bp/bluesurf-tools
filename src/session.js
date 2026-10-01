import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "./client.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function profileDir() {
  return path.join(root, ".chrome-profile");
}

// Surf's session cookie is a browser-session cookie, so Chromium drops it when
// the context closes and the profile alone never stays signed in. Keep our own
// copy of the cookies and load it on every launch.
export function cookieJarPath() {
  return path.join(root, ".surf-cookies.json");
}

export async function loadCookieJar(context, file = cookieJarPath()) {
  let cookies;
  try {
    cookies = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
  await context.addCookies(cookies);
  return true;
}

export async function saveCookieJar(context, file = cookieJarPath()) {
  await writeFile(file, JSON.stringify(await context.cookies()), { mode: 0o600 });
}

// Headless has no one to sign in, so fail fast. Headed waits long enough for
// you to finish SSO in the window.
const WARM_TIMEOUT_MS = { headless: 10_000, headed: 120_000 };

async function warmSession(context, origin, timeoutMs) {
  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await context.request.get(`${origin}/api/instance/currentUser`, {
      headers: { Accept: "application/json" },
    });
    if (response.ok()) return;
    await page.waitForTimeout(250);
  }
  const error = new Error("Blue Surf session expired. Run npm run login and retry.");
  error.status = 401;
  throw error;
}

export async function createSessionRequest({
  origin = process.env.BLUESURF_ORIGIN ?? "https://surf.bluepeople.com",
  userDataDir = profileDir(),
  headless = true,
  warmTimeoutMs = Number(process.env.BLUESURF_WARM_TIMEOUT_MS) ||
    WARM_TIMEOUT_MS[headless ? "headless" : "headed"],
} = {}) {
  await mkdir(userDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1400, height: 900 },
  });

  try {
    await loadCookieJar(context);
    await warmSession(context, origin, warmTimeoutMs);
    await saveCookieJar(context);
  } catch (error) {
    await context.close();
    throw error;
  }

  async function request(method, requestPath, body) {
    const response = await context.request.fetch(`${origin}${requestPath}`, {
      method,
      data: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined
          ? { Accept: "*/*" }
          : { Accept: "application/json", "Content-Type": "application/json" },
    });
    if (!response.ok()) {
      const error = new Error(`Blue Surf ${response.status()} on ${requestPath}`);
      error.status = response.status();
      throw error;
    }
    const contentType = response.headers()["content-type"] ?? "";
    if (/application\/json/i.test(contentType)) {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }
    if (/text\//i.test(contentType)) {
      return response.text();
    }
    return Buffer.from(await response.body());
  }

  // The board UI tells other viewers to refresh through the SignalR project
  // hub after a move; do the same so teammates' open boards update.
  async function notifyProjectUpdated(projectCode, workItemId) {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.evaluate(
      async ({ projectCode, workItemId }) => {
        const separator = "\u001e";
        const negotiate = await fetch("/api/hub/projectHub/negotiate?negotiateVersion=1", {
          method: "POST",
        }).then((response) => response.json());
        const id = negotiate.connectionToken ?? negotiate.connectionId;
        const url = `${location.origin.replace(/^http/, "ws")}/api/hub/projectHub?id=${id}`;
        await new Promise((resolve, reject) => {
          const socket = new WebSocket(url);
          const timer = setTimeout(() => {
            socket.close();
            reject(new Error("project hub timed out"));
          }, 5000);
          const send = (message) => socket.send(JSON.stringify(message) + separator);
          socket.onerror = () => {
            clearTimeout(timer);
            reject(new Error("project hub connection failed"));
          };
          socket.onopen = () => send({ protocol: "json", version: 1 });
          socket.onmessage = () => {
            socket.onmessage = null;
            send({ arguments: [projectCode], invocationId: "0", target: "JoinGroup", type: 1 });
            send({ arguments: [projectCode, workItemId], invocationId: "1", target: "ProjectUpdated", type: 1 });
            setTimeout(() => {
              clearTimeout(timer);
              socket.close();
              resolve();
            }, 500);
          };
        });
      },
      { projectCode, workItemId },
    );
  }

  return {
    request,
    notifyProjectUpdated,
    async close() {
      // Keep any cookie Surf rotated during this run.
      await saveCookieJar(context).catch(() => {});
      await context.close();
    },
  };
}

export async function createSessionClient(options) {
  const session = await createSessionRequest(options);
  return {
    ...createClient({ request: session.request, origin: options?.origin }),
    notifyProjectUpdated: session.notifyProjectUpdated,
    close: session.close,
  };
}
