// Headless smoke test: builds are validated elsewhere; this boots the real
// game in headless Chromium and asserts it renders without runtime errors.
//
// Run: npm run smoke   (requires `npm run build` first; this script does it)
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import puppeteer from "puppeteer";

const PORT = 4178;
const URL = `http://localhost:${PORT}/`;

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: "inherit", ...opts });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error(`server did not start at ${url}`);
}

let server, browser, failed = false;
const fail = (msg) => { console.error("✖ " + msg); failed = true; };
const ok = (msg) => console.log("✔ " + msg);

try {
  console.log("Building...");
  await run("npm", ["run", "build"]);

  console.log("Starting preview server...");
  server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
  });
  await waitForServer(URL);

  browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-webgl",
      "--ignore-gpu-blocklist",
    ],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on("pageerror", (e) => { errors.push("pageerror: " + e.message); console.error("  [pageerror]", e.message); });
  page.on("console", (m) => { if (m.type() === "error") { errors.push("console.error: " + m.text()); console.error("  [console]", m.text()); } });
  page.on("error", (e) => { errors.push("crash: " + e.message); console.error("  [crash]", e.message); });

  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 20000 });

  // Poll for readiness (more robust than waitForFunction across reloads).
  let ready = false;
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    try {
      ready = await page.evaluate(() => !!(window.__VOXELCRAFT__ && window.__VOXELCRAFT__.ready));
    } catch (e) { /* frame transient */ }
    if (ready) break;
  }
  if (!ready) fail("game did not become ready within timeout");
  await sleep(500);

  const state = await page.evaluate(() => window.__VOXELCRAFT__.state);
  // Poll the clock until it advances (robust against a slow first frame).
  const t0 = state.timeOfDay;
  let t1 = t0;
  for (let i = 0; i < 20 && t1 <= t0; i++) {
    await sleep(200);
    t1 = await page.evaluate(() => window.__VOXELCRAFT__.state.timeOfDay);
  }
  const canvas = await page.evaluate(() => {
    const c = document.getElementById("app");
    return { w: c.width, h: c.height };
  });
  const hotbarSlots = await page.evaluate(() => document.querySelectorAll("#hotbar .hotbar-slot").length);

  // --- Assertions ---
  if (errors.length === 0) ok("no runtime/console errors");
  else fail("runtime errors:\n  " + errors.join("\n  "));

  if (canvas.w > 0 && canvas.h > 0) ok(`canvas rendered (${canvas.w}x${canvas.h})`);
  else fail("canvas has zero size");

  if (state.chunkCount > 0) ok(`world built (${state.chunkCount} chunks)`);
  else fail("no chunks built");

  if (state.triangles > 0) ok(`geometry rendered (${state.triangles} triangles, ${state.drawCalls} draw calls)`);
  else fail("nothing rendered (0 triangles)");

  const distinct = new Set(state.sampleHeights).size;
  if (distinct > 1) ok(`procedural terrain varies (heights ${JSON.stringify(state.sampleHeights)})`);
  else fail(`terrain looks flat (heights ${JSON.stringify(state.sampleHeights)})`);

  if (state.playerY > 0 && state.playerY < state.worldSize[1] + 5) ok(`player positioned (y=${state.playerY.toFixed(1)})`);
  else fail(`player out of expected range (y=${state.playerY})`);

  if (state.treeCount > 0) ok(`trees generated (${state.treeCount})`);
  else fail("no trees generated");

  if (hotbarSlots >= 5) ok(`hotbar rendered (${hotbarSlots} slots)`);
  else fail(`hotbar missing slots (${hotbarSlots})`);

  if (t1 > t0) ok(`day/night cycle advancing (t ${t0.toFixed(4)} -> ${t1.toFixed(4)})`);
  else fail(`time not advancing (t ${t0} -> ${t1})`);

  if (state.caveCount > 0) ok(`caves carved (${state.caveCount} air voxels)`);
  else fail("no caves carved");

  if (state.waterCount > 0) ok(`water filled (${state.waterCount} voxels)`);
  else fail("no water generated");

  if (state.lavaCount > 0) ok(`lava pooled (${state.lavaCount} voxels)`);
  else fail("no lava generated");

  console.log("\nState:", JSON.stringify(state));
} catch (e) {
  fail("harness error: " + e.message);
} finally {
  if (browser) await browser.close();
  if (server) server.kill();
}

console.log(failed ? "\nSMOKE: FAIL" : "\nSMOKE: PASS");
process.exit(failed ? 1 : 0);
