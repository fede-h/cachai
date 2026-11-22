#!/usr/bin/env node
/**
 * CachAI Demo Screen Recording & Screenshot Capture Script
 *
 * Launches headless Chromium via Playwright, walks through the live CachAI web
 * application, captures key screenshots, records a 1280x720 demo video (.webm),
 * and optionally converts it to .mp4 when ffmpeg is available on PATH.
 *
 * Environment variables:
 *   BASE_URL       Target web-blog URL (default: http://localhost:3000)
 *   CHROMIUM_PATH  Path to Chromium executable (default: /snap/bin/chromium)
 *   OUT_DIR        Output directory (default: <repo-root>/docs/demo)
 *   AUDIT_TIMEOUT_MS  Max wait for live audit cycle (default: 90000)
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/snap/bin/chromium";
const OUT_DIR = process.env.OUT_DIR
  ? path.resolve(process.env.OUT_DIR)
  : path.resolve(REPO_ROOT, "docs/demo");
const AUDIT_TIMEOUT_MS = Number.parseInt(
  process.env.AUDIT_TIMEOUT_MS || "90000",
  10
);

const VIEWPORT = { width: 1280, height: 720 };
const SETTLE_MS = 1500;

async function loadPlaywright() {
  try {
    return await import("playwright-core");
  } catch {
    try {
      return await import("playwright");
    } catch {
      console.error(
        [
          "Error: Neither 'playwright-core' nor 'playwright' could be loaded.",
          "Install one of them before running this script, for example:",
          "  npm install --no-save playwright-core",
          "or:",
          "  npm install --no-save playwright",
        ].join("\n")
      );
      process.exit(1);
    }
  }
}

async function waitForPageReady(page) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 10000 });
  } catch {
    // Some routes may keep background connections open; proceed once DOM is settled.
  }
}

async function smoothScroll(
  page,
  {
    stepPx = 220,
    stepDelayMs = 140,
    pauseAtBottomMs = 600,
    returnToTop = true,
    maxSteps = 25,
  } = {}
) {
  const maxScroll = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  );

  if (maxScroll <= 0) {
    return;
  }

  const downSteps = Math.min(maxSteps, Math.ceil(maxScroll / stepPx));
  const effectiveStep = Math.ceil(maxScroll / downSteps);

  for (let i = 0; i < downSteps; i += 1) {
    await page.evaluate((delta) => {
      window.scrollBy({ top: delta, behavior: "smooth" });
    }, effectiveStep);
    await page.waitForTimeout(stepDelayMs);
  }

  await page.waitForTimeout(pauseAtBottomMs);

  if (returnToTop) {
    for (let i = 0; i < downSteps; i += 1) {
      await page.evaluate((delta) => {
        window.scrollBy({ top: -delta, behavior: "smooth" });
      }, effectiveStep);
      await page.waitForTimeout(Math.max(80, Math.floor(stepDelayMs * 0.75)));
    }
    await page.evaluate(() => {
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
}

function moveFileSafely(srcPath, destPath) {
  try {
    fs.renameSync(srcPath, destPath);
  } catch (err) {
    if (err && err.code === "EXDEV") {
      fs.copyFileSync(srcPath, destPath);
      fs.unlinkSync(srcPath);
    } else {
      throw err;
    }
  }
}

function isFfmpegAvailable() {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return !probe.error && probe.status === 0;
}

function convertWebmToMp4(webmPath, mp4Path) {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      webmPath,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ],
    { stdio: "pipe", encoding: "utf8" }
  );

  if (result.error || result.status !== 0) {
    const details = result.stderr ? `\n${result.stderr.trim()}` : "";
    console.warn(
      `Warning: ffmpeg failed to convert WebM to MP4 (exit code ${result.status}).${details}`
    );
    return false;
  }
  return true;
}

async function runDemoRecording() {
  const { chromium } = await loadPlaywright();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const videoTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cachai-demo-"));

  console.log(`Target URL:    ${BASE_URL}`);
  console.log(`Chromium path: ${CHROMIUM_PATH}`);
  console.log(`Output dir:    ${OUT_DIR}`);

  const generatedArtifacts = [];
  let browser;
  let context;
  let page;
  let videoHandle = null;

  try {
    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
    });

    context = await browser.newContext({
      viewport: VIEWPORT,
      recordVideo: {
        dir: videoTempDir,
        size: VIEWPORT,
      },
    });

    page = await context.newPage();
    videoHandle = page.video();

    // 1. Reports Home (/)
    console.log("[1/4] Opening Reports Home (/)...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageReady(page);
    await page.waitForTimeout(SETTLE_MS);

    const homeScreenshot = path.join(OUT_DIR, "01-home.png");
    await page.screenshot({ path: homeScreenshot });
    generatedArtifacts.push(homeScreenshot);

    // 2. Leaderboard (/leaderboard)
    console.log("[2/4] Navigating to Leaderboard (/leaderboard)...");
    await page.goto(`${BASE_URL}/leaderboard`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForPageReady(page);
    await smoothScroll(page, { returnToTop: true });
    await page.waitForTimeout(SETTLE_MS);

    const leaderboardScreenshot = path.join(OUT_DIR, "02-leaderboard.png");
    await page.screenshot({ path: leaderboardScreenshot });
    generatedArtifacts.push(leaderboardScreenshot);

    // 3. Telemetry & Live Audit Trigger (/telemetry)
    console.log("[3/4] Navigating to Telemetry (/telemetry)...");
    await page.goto(`${BASE_URL}/telemetry`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await waitForPageReady(page);

    const triggerButton = page
      .getByRole("button", { name: /run live audit|demo|trigger|audit|run/i })
      .first();

    const buttonVisible = await triggerButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (buttonVisible) {
      console.log("      Clicking Live Audit trigger button...");
      await triggerButton.click();

      // Give React a moment to enter the busy state before observing completion.
      await page
        .waitForFunction(
          () => {
            const btn = document.querySelector("button[aria-busy]");
            return btn !== null && btn.getAttribute("aria-busy") === "true";
          },
          { timeout: 3000 }
        )
        .catch(() => null);

      // Wait for either the status result banner, an error alert, or the button to exit aria-busy.
      const statusBanner = page.locator('[role="status"]').first();
      const errorBanner = page
        .locator('[role="alert"]')
        .filter({ hasText: /audit trigger failed/i })
        .first();

      try {
        await Promise.race([
          statusBanner.waitFor({ state: "visible", timeout: AUDIT_TIMEOUT_MS }),
          errorBanner.waitFor({ state: "visible", timeout: AUDIT_TIMEOUT_MS }),
          page.waitForFunction(
            () => {
              const btn = document.querySelector("button[aria-busy]");
              return btn !== null && btn.getAttribute("aria-busy") === "false";
            },
            { timeout: AUDIT_TIMEOUT_MS }
          ),
        ]);
      } catch {
        console.warn(
          `      Timed out after ${AUDIT_TIMEOUT_MS}ms waiting for live audit completion; capturing current telemetry state.`
        );
      }

      await waitForPageReady(page);
    } else {
      console.warn(
        "      Demo trigger button not found on /telemetry; capturing current page state."
      );
    }

    await page.waitForTimeout(SETTLE_MS);
    const telemetryScreenshot = path.join(
      OUT_DIR,
      "03-telemetry-live-audit.png"
    );
    await page.screenshot({ path: telemetryScreenshot });
    generatedArtifacts.push(telemetryScreenshot);

    // 4. Latest Published Audit Report (/ -> /posts/[slug])
    console.log("[4/4] Navigating back to / to open latest published audit report...");
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForPageReady(page);

    const reportLink = page.locator('a[href^="/posts/"]').first();
    const hasReportLink = await reportLink
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasReportLink) {
      const href = await reportLink.getAttribute("href");
      console.log(`      Opening report: ${href}`);
      await Promise.all([
        page.waitForURL(/\/posts\/.+/, { timeout: 15000 }).catch(() => null),
        reportLink.click(),
      ]);
      await waitForPageReady(page);
      await smoothScroll(page, { returnToTop: true });
    } else {
      console.warn(
        '      No published report link (a[href^="/posts/"]) found on /; capturing home view.'
      );
    }

    await page.waitForTimeout(SETTLE_MS);
    const reportScreenshot = path.join(OUT_DIR, "04-audit-report.png");
    await page.screenshot({ path: reportScreenshot });
    generatedArtifacts.push(reportScreenshot);
  } finally {
    if (page && !page.isClosed()) {
      await page.close();
    }
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }

  // Finalize recorded video
  const finalWebmPath = path.join(OUT_DIR, "cachai-demo.webm");
  let recordedVideoPath = null;

  if (videoHandle) {
    try {
      recordedVideoPath = await videoHandle.path();
    } catch {
      recordedVideoPath = null;
    }
  }

  if (!recordedVideoPath || !fs.existsSync(recordedVideoPath)) {
    const tempFiles = fs
      .readdirSync(videoTempDir)
      .filter((f) => f.endsWith(".webm"));
    if (tempFiles.length > 0) {
      recordedVideoPath = path.join(videoTempDir, tempFiles[0]);
    }
  }

  if (recordedVideoPath && fs.existsSync(recordedVideoPath)) {
    moveFileSafely(recordedVideoPath, finalWebmPath);
    generatedArtifacts.push(finalWebmPath);
  } else {
    console.warn("Warning: No recorded .webm video file was produced.");
  }

  fs.rmSync(videoTempDir, { recursive: true, force: true });

  // Optional ffmpeg conversion to MP4
  if (fs.existsSync(finalWebmPath)) {
    if (isFfmpegAvailable()) {
      const finalMp4Path = path.join(OUT_DIR, "cachai-demo.mp4");
      console.log("Converting WebM recording to MP4 via ffmpeg...");
      if (convertWebmToMp4(finalWebmPath, finalMp4Path)) {
        generatedArtifacts.push(finalMp4Path);
      }
    } else {
      console.log(
        "Info: ffmpeg is not installed on PATH; skipping MP4 conversion (cachai-demo.webm is ready)."
      );
    }
  }

  console.log("\nDemo recording complete. Generated artifacts:");
  for (const artifact of generatedArtifacts) {
    const relPath = path.relative(REPO_ROOT, artifact) || artifact;
    console.log(`  - ${relPath}`);
  }
}

runDemoRecording().catch((err) => {
  console.error("Demo recording failed:", err);
  process.exit(1);
});
