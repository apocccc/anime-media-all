/**
 * ピクセル確認用スクリーンショット(デザイン仕様書 §32)。
 * 使い方: node scripts/screenshot.mjs <url> <out.png> [full]
 * ビューポートは参考画像と同じ 1672 × 941。
 */
import { chromium } from "playwright-core";

const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const url = process.argv[2] ?? "http://localhost:3000/en";
const out = process.argv[3] ?? "screenshot.png";
const fullPage = process.argv[4] === "full";

const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: 1672, height: 941 } });
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage });
await browser.close();
console.log("saved", out);
