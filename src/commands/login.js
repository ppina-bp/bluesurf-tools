import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { loadRuntimeContext } from "../runtime-context.js";
import { saveCookieJar } from "../session.js";

const timeoutMs = 5 * 60_000;

export async function loginCommand() {
  const ctx = await loadRuntimeContext();
  const { profileDir, cookieJarPath } = ctx.session;
  const origin = ctx.origin;
  await mkdir(profileDir, { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1400, height: 900 },
    title: "Blue Surf agent",
  });

  let closed = false;
  context.on("close", () => {
    closed = true;
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(origin, { waitUntil: "domcontentloaded" });

  console.log(`
Profile: ${profileDir}
Origin:  ${origin}

Complete SSO in the window that just opened. It saves the session and
closes by itself once you are signed in (waits up to 5 minutes).
`);

  async function signedIn() {
    const response = await context.request.get(`${origin}/api/instance/currentUser`, {
      headers: { Accept: "application/json" },
    });
    return response.ok();
  }

  const deadline = Date.now() + timeoutMs;
  while (!closed && Date.now() < deadline) {
    if (await signedIn().catch(() => false)) {
      await saveCookieJar(context, cookieJarPath);
      await context.close();
      console.log(`Signed in. Session saved to ${cookieJarPath}.`);
      console.log("Next: bluesurf sprint, or bluesurf ticket PRY-XXX");
      return 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!closed) await context.close();
  console.error(
    closed
      ? "The window was closed before sign-in finished. Run bluesurf login again."
      : "Timed out waiting for sign-in. Run bluesurf login again.",
  );
  return 1;
}