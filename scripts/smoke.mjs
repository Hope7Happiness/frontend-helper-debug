import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const workspace = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 4173;
const baseUrl = `http://127.0.0.1:${port}`;
const chromePath =
  process.env.FRONTEND_HELPER_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const server = spawn(
  "npm",
  ["run", "dev", "--workspace", "@frontend-helper/demo", "--", "--port", String(port), "--strictPort"],
  { cwd: workspace, stdio: ["ignore", "pipe", "pipe"] },
);

let serverOutput = "";
server.stdout.on("data", (chunk) => (serverOutput += chunk));
server.stderr.on("data", (chunk) => (serverOutput += chunk));

let browser;

try {
  await waitForServer(baseUrl);
  browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("frontend-helper-overlay").waitFor({ state: "attached" });

  const panel = page.locator("frontend-helper-overlay").locator("[data-fh-panel]");
  await expectVisible(panel, "debug panel");
  const header = page.locator("frontend-helper-overlay").locator("[data-fh-header]");
  const beforeDrag = await header.boundingBox();
  if (!beforeDrag) throw new Error("The debug panel header has no bounding box");
  await page.mouse.move(beforeDrag.x + 120, beforeDrag.y + 20);
  await page.mouse.down();
  await page.mouse.move(120, 120);
  await page.mouse.up();
  const panelPosition = await panel.evaluate((element) => ({ left: element.style.left, top: element.style.top }));
  assert(panelPosition.left !== "" && panelPosition.top !== "", "debug panel did not become draggable");
  await panel.locator("[data-fh-start]").click();

  await page.evaluate(() => {
    document.body.style.minHeight = "2000px";
    const scrollBox = document.createElement("div");
    scrollBox.dataset.testid = "scroll-fixture";
    scrollBox.style.cssText = "position:fixed;left:-10000px;top:0;width:120px;height:60px;overflow:auto;";
    scrollBox.innerHTML = `<div style="width:480px;height:240px"></div>`;
    document.body.append(scrollBox);
    scrollBox.scrollLeft = 40;
    scrollBox.scrollTop = 20;
    window.scrollTo({ top: 40, behavior: "instant" });
  });
  await page.waitForTimeout(30);
  await page.evaluate(() => {
    const scrollBox = document.querySelector("[data-testid='scroll-fixture']");
    if (!(scrollBox instanceof HTMLElement)) throw new Error("scroll fixture is missing");
    scrollBox.scrollLeft = 140;
    scrollBox.scrollTop = 80;
    window.scrollTo({ top: 120, behavior: "instant" });
  });
  await page.waitForTimeout(80);

  await page.locator("[data-testid='sync-draft']").click();
  await page.locator("[data-testid='sync-dialog']").waitFor({ state: "visible" });
  await page.locator("[data-testid='close-dialog']").click();
  await page.locator("[data-testid='sync-dialog']").waitFor({ state: "hidden" });
  await page.locator("[data-testid='sync-dialog']").waitFor({ state: "visible", timeout: 5000 });

  await panel.locator("[data-fh-picker]").click();
  const dialogBox = await page.locator("[data-testid='sync-dialog']").boundingBox();
  if (!dialogBox) throw new Error("The demo dialog has no bounding box");
  await page.mouse.move(dialogBox.x + 8, dialogBox.y + 8);
  await page.mouse.click(dialogBox.x + 8, dialogBox.y + 8);

  const commentCard = page.locator("frontend-helper-overlay").locator("[data-fh-comment]");
  await expectVisible(commentCard, "annotation card");
  await commentCard.locator("textarea").fill("这个弹窗已经关闭，却被旧请求重新打开了");
  await commentCard.locator("[data-fh-comment-save]").click();
  await panel.locator("[data-fh-start]").click();

  await page.waitForFunction(() => {
    const host = document.querySelector("frontend-helper-overlay");
    return host?.shadowRoot?.querySelector("[data-fh-trace-id]")?.textContent?.startsWith("fh_");
  });
  const traceId = (await panel.locator("[data-fh-trace-id]").textContent())?.trim();
  assert(traceId?.startsWith("fh_"), "the server did not return a trace ID");

  const storedResponse = await page.request.get(`${baseUrl}/__frontend-helper/traces/${traceId}`);
  assert(storedResponse.ok(), `trace GET failed with ${storedResponse.status()}`);
  let trace = await storedResponse.json();

  assert(trace.format === "frontend-helper-trace", "unexpected trace format");
  assert(trace.rrwebEvents.length > 0, "rrweb events were not captured");
  assert(trace.timeline.some((event) => event.kind === "user.click"), "clicks were not captured");
  const scrollEvents = trace.timeline.filter((event) => event.kind === "user.scroll");
  assert(
    scrollEvents.some(
      (event) =>
        event.data?.target === "element" &&
        event.target?.testId === "scroll-fixture" &&
        event.data.x === 40 &&
        event.data.y === 20,
    ),
    "nested element scroll was not captured at the expected position",
  );
  assert(
    scrollEvents.some(
      (event) =>
        event.data?.target === "element" &&
        event.target?.testId === "scroll-fixture" &&
        event.data.x === 140 &&
        event.data.y === 80,
    ),
    "nested element scroll did not capture its final position",
  );
  const pageScrollEvents = scrollEvents.filter((event) => event.data?.target === "window");
  assert(
    pageScrollEvents.some((event) => event.data.x === 0 && event.data.y === 40) &&
      pageScrollEvents.some((event) => event.data.x === 0 && event.data.y === 120),
    "page scroll did not capture its first and final positions",
  );
  assert(pageScrollEvents.length === 2, "continuous page scrolling should only capture the first and last positions");
  assert(
    scrollEvents.filter((event) => event.data?.target === "element" && event.target?.testId === "scroll-fixture").length === 2,
    "continuous nested scrolling should only capture the first and last positions",
  );
  assert(
    !scrollEvents.some((event) => event.data?.target === "window" && event.data.x === 0 && event.data.y === 0),
    "initial no-op page scroll was captured",
  );
  assert(trace.annotations.length === 1, "annotation was not captured");
  assert(trace.annotations[0].target.testId === "sync-dialog", "annotation did not reference the dialog");
  assert(trace.storage.id === traceId, "stored trace ID does not match the UI");
  assert(trace.service.name === "@frontend-helper/demo", "service name was not pinned");
  assert(trace.service.version === "0.0.1", "service version was not pinned");

  const listResponse = await page.request.get(`${baseUrl}/__frontend-helper/traces`);
  assert(listResponse.ok(), `trace list failed with ${listResponse.status()}`);
  const list = await listResponse.json();
  assert(list.traces.some((item) => item.id === traceId), "saved trace is missing from the list");

  await panel.locator("[data-fh-library-toggle]").click();
  await panel.locator(`[data-fh-action="open"][data-fh-id="${traceId}"]`).click();
  await panel.locator("[data-fh-name-input]").fill("异步弹窗竞态");
  const renameResponsePromise = page.waitForResponse(
    (response) => response.request().method() === "PATCH" && response.url().endsWith(`/__frontend-helper/traces/${traceId}`),
  );
  await panel.locator("[data-fh-action='rename']").click();
  const renameResponse = await renameResponsePromise;
  assert(renameResponse.ok(), `trace rename failed with ${renameResponse.status()}`);

  const renamedResponse = await page.request.get(`${baseUrl}/__frontend-helper/traces/${traceId}`);
  trace = await renamedResponse.json();
  assert(trace.storage.name === "异步弹窗竞态", "trace rename was not persisted");

  await mkdir(join(workspace, "artifacts"), { recursive: true });
  await page.screenshot({ path: join(workspace, "artifacts/demo.png"), fullPage: true });
  await writeFile(join(workspace, "artifacts/demo-trace.fhtrace.json"), JSON.stringify(trace, null, 2));

  await panel.locator("[data-fh-action='back']").click();
  page.once("dialog", (dialog) => dialog.accept());
  const listDeleteButton = panel.locator(`[data-fh-action="delete"][data-fh-id="${traceId}"]`);
  await listDeleteButton.click();
  await listDeleteButton.waitFor({ state: "detached" });
  const deletedResponse = await page.request.get(`${baseUrl}/__frontend-helper/traces/${traceId}`);
  assert(deletedResponse.status() === 404, "deleted trace is still available");
  console.log(
    `Smoke test passed for ${traceId}: list, version pin, detail, rename, and DELETE all work.`,
  );
} catch (error) {
  console.error(serverOutput);
  throw error;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}

async function waitForServer(url) {
  const timeoutAt = Date.now() + 30_000;
  while (Date.now() < timeoutAt) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function expectVisible(locator, label) {
  if (!(await locator.isVisible())) throw new Error(`Expected ${label} to be visible`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
