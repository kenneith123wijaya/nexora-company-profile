import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const bundledPlaywright = join(
  process.env.USERPROFILE || "",
  ".cache",
  "codex-runtimes",
  "codex-primary-runtime",
  "dependencies",
  "node",
  "node_modules",
  ".pnpm",
  "playwright@1.61.1",
  "node_modules",
  "playwright",
  "index.mjs"
);
const playwrightModule = existsSync(bundledPlaywright) ? pathToFileURL(bundledPlaywright).href : "playwright";
const { chromium } = await import(playwrightModule);
const installedBrowsers = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];
const executablePath = installedBrowsers.find(existsSync);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const output = join(process.cwd(), "artifacts");
const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:4173").replace(/\/$/, "");
const entrySeenKey = "nexora.prototypeEntrySeen.v1";
await mkdir(output, { recursive: true });

const issues = [];
const pageDefinitions = [
  { path: "/", key: "home", marker: ".hero", title: "Lihat produk yang bekerja" },
  { path: "/services", key: "services", marker: "[data-service-stage]", title: "Bangun sistem" },
  { path: "/prototype-work", key: "prototype-work", marker: "[data-project='erp']", title: "Bukti yang dapat Anda pelajari" },
  { path: "/solutions", key: "solutions", marker: "[data-solution-stage]", title: "Mulai dari masalah operasional" },
  { path: "/process", key: "process", marker: "[data-process='0']", title: "Keputusan yang jelas" },
  { path: "/about", key: "about", marker: ".about-values", title: "Pemahaman bisnis" },
  { path: "/contact", key: "contact", marker: "#inquiry-form", title: "Bawa kendala" }
];

const attachDiagnostics = (page, label) => {
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") issues.push(`${label} console ${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => issues.push(`${label} page error: ${error.message}`));
};

const readCanvasSignal = (page) => page.locator("[data-product-scene] canvas").evaluate((canvas) => {
  const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
  const ready = canvas.closest("[data-product-scene]").classList.contains("is-webgl-ready");
  if (!context) return { ready, width: canvas.width, height: canvas.height, litSamples: 0, spread: 0 };
  const pixels = new Uint8Array(context.drawingBufferWidth * context.drawingBufferHeight * 4);
  context.readPixels(0, 0, context.drawingBufferWidth, context.drawingBufferHeight, context.RGBA, context.UNSIGNED_BYTE, pixels);
  let litSamples = 0;
  let minimum = 765;
  let maximum = 0;
  for (let index = 0; index < pixels.length; index += 64) {
    const brightness = pixels[index] + pixels[index + 1] + pixels[index + 2];
    if (pixels[index + 3] > 8 && brightness > 18) litSamples += 1;
    minimum = Math.min(minimum, brightness);
    maximum = Math.max(maximum, brightness);
  }
  return { ready, width: context.drawingBufferWidth, height: context.drawingBufferHeight, litSamples, spread: maximum - minimum };
});

const waitForPage = async (page, definition) => {
  await page.goto(`${baseUrl}${definition.path}`, { waitUntil: "networkidle" });
  await page.locator(definition.marker).waitFor({ state: "visible" });
  await page.waitForTimeout(780);
};

const markEntrySeen = (page) => page.addInitScript((key) => {
  try {
    window.localStorage.setItem(key, "true");
  } catch {
    // Ignore storage restrictions in browser test environments.
  }
}, entrySeenKey);

const readPageState = (page) => page.evaluate(() => {
  const heading = document.querySelector("main h1");
  const activeDesktop = [...document.querySelectorAll(".desktop-nav [aria-current='page']")];
  const activeCta = document.querySelector(".header-cta[aria-current='page']");
  return {
    page: document.body.dataset.page,
    title: document.title,
    heading: heading?.textContent.trim() || "",
    headingRight: heading ? Math.round(heading.getBoundingClientRect().right) : 0,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    missingAlt: [...document.images].filter((image) => !image.hasAttribute("alt")).length,
    duplicateIds: [...document.querySelectorAll("[id]")]
      .map((element) => element.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index),
    activeDesktop: activeDesktop.map((link) => link.getAttribute("href")),
    activeCta: activeCta?.getAttribute("href") || "",
    language: document.documentElement.lang,
    pageReady: document.body.classList.contains("is-page-ready")
  };
});

const firstVisitPage = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
attachDiagnostics(firstVisitPage, "first-visit");
await firstVisitPage.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
await firstVisitPage.waitForURL(/\/prototype-work$/);
await firstVisitPage.locator("[data-preview-carousel]").waitFor({ state: "visible" });
const firstVisitState = await firstVisitPage.evaluate((key) => ({
  page: document.body.dataset.page,
  path: window.location.pathname,
  entrySeen: window.localStorage.getItem(key)
}), entrySeenKey);
if (firstVisitState.page !== "prototype-work" || firstVisitState.path !== "/prototype-work" || firstVisitState.entrySeen !== "true") {
  issues.push(`First visit did not open Prototype Work: ${JSON.stringify(firstVisitState)}`);
}
await firstVisitPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await firstVisitPage.locator(".hero").waitFor({ state: "visible" });
const homeAfterEntry = await firstVisitPage.evaluate(() => ({
  page: document.body.dataset.page,
  path: window.location.pathname,
  activeRoute: document.querySelector(".desktop-nav [aria-current='page']")?.getAttribute("href") || ""
}));
if (homeAfterEntry.page !== "home" || homeAfterEntry.path !== "/" || homeAfterEntry.activeRoute !== "/") {
  issues.push(`Home was not accessible after the first entry: ${JSON.stringify(homeAfterEntry)}`);
}
await firstVisitPage.close();

const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
await markEntrySeen(desktop);
attachDiagnostics(desktop, "desktop");
let submittedInquiry = null;
await desktop.route("**/api/inquiry", async (route) => {
  submittedInquiry = JSON.parse(route.request().postData() || "{}");
  await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "INQ-E2E-TEST" }) });
});

const desktopPages = {};
for (const definition of pageDefinitions) {
  await waitForPage(desktop, definition);
  const state = await readPageState(desktop);
  desktopPages[definition.key] = state;
  if (state.page !== definition.key) issues.push(`${definition.path} rendered page key ${state.page}.`);
  if (!state.heading.includes(definition.title)) issues.push(`${definition.path} did not render its focused page heading.`);
  if (state.scrollWidth > state.clientWidth) issues.push(`${definition.path} desktop overflow: ${state.scrollWidth}/${state.clientWidth}.`);
  if (state.headingRight > state.clientWidth + 1) issues.push(`${definition.path} heading exceeded the viewport.`);
  if (state.missingAlt) issues.push(`${definition.path} has ${state.missingAlt} images without alt attributes.`);
  if (state.duplicateIds.length) issues.push(`${definition.path} has duplicate IDs: ${state.duplicateIds.join(", ")}.`);
  if (state.language !== "id") issues.push(`${definition.path} language is ${state.language}.`);
  if (!state.pageReady) issues.push(`${definition.path} did not finish its page-entry transition.`);
  if (definition.key !== "contact" && (state.activeDesktop.length !== 1 || state.activeDesktop[0] !== definition.path)) {
    issues.push(`${definition.path} did not expose one correct active desktop navigation item.`);
  }
  if (definition.key === "contact" && state.activeCta !== "/contact") issues.push("Contact CTA was not marked as the current page.");
  await desktop.screenshot({ path: join(output, `page-${definition.key}-desktop.png`), fullPage: false });
  if (definition.key !== "home") await desktop.screenshot({ path: join(output, `page-${definition.key}-full.png`), fullPage: true });
}

await waitForPage(desktop, pageDefinitions[0]);
await desktop.waitForFunction(() => document.querySelector("[data-product-scene]")?.classList.contains("is-webgl-ready"), null, { timeout: 10000 });
const desktopCanvasSignal = await readCanvasSignal(desktop);
if (!desktopCanvasSignal.ready || desktopCanvasSignal.litSamples < 250 || desktopCanvasSignal.spread < 30) {
  issues.push(`Desktop 3D canvas was blank or visually flat: ${JSON.stringify(desktopCanvasSignal)}`);
}
const homeStructure = await desktop.evaluate(() => ({
  mainSections: document.querySelectorAll("main > section").length,
  legacySections: ["services", "work", "solutions", "process", "about", "contact"].filter((id) => document.getElementById(id)),
  routes: [...document.querySelectorAll(".path-list a")].map((link) => link.getAttribute("href"))
}));
if (homeStructure.legacySections.length) issues.push(`Homepage still contains former single-page sections: ${homeStructure.legacySections.join(", ")}.`);
if (homeStructure.routes.length !== 6) issues.push("Homepage route list does not expose six focused destinations.");
if (homeStructure.routes[0] !== "/prototype-work") issues.push("Homepage does not lead with Prototype Work.");
const shellPriority = await desktop.evaluate(() => ({
  firstDesktopRoute: document.querySelector(".desktop-nav a")?.getAttribute("href"),
  visibleBrandText: document.querySelector(".brand")?.textContent.trim() || "",
  transitionLayer: Boolean(document.querySelector("[data-page-transition]"))
}));
if (shellPriority.firstDesktopRoute !== "/") issues.push("Desktop navigation does not expose Home first.");
if (shellPriority.visibleBrandText !== "N") issues.push("A brand wordmark is still visible in the header.");
if (!shellPriority.transitionLayer) issues.push("Page transition layer was not mounted.");

const prototypeNavigation = desktop.waitForURL(/\/prototype-work$/);
await desktop.locator('.desktop-nav a[href="/prototype-work"]').evaluate((link) => link.click());
await desktop.waitForTimeout(120);
const transitionState = await desktop.evaluate(() => ({
  leaving: document.body.classList.contains("is-page-leaving"),
  overlayOpacity: Number.parseFloat(getComputedStyle(document.querySelector("[data-page-transition]")).opacity)
}));
if (!transitionState.leaving || transitionState.overlayOpacity <= 0) issues.push(`Page exit transition did not activate: ${JSON.stringify(transitionState)}`);
await prototypeNavigation;

await waitForPage(desktop, pageDefinitions[1]);
await desktop.click('[data-service-category="customPlatforms"]');
await desktop.waitForTimeout(220);
if (!(await desktop.locator("[data-service-title]").textContent()).includes("proses khusus")) issues.push("Service explorer did not update.");
const serviceCtaHref = await desktop.locator("[data-service-cta]").getAttribute("href");
if (!serviceCtaHref?.includes("service=Custom%20Software%20Development")) issues.push("Service CTA did not preserve its inquiry context.");
await Promise.all([desktop.waitForURL(/\/contact\?service=/), desktop.click("[data-service-cta]")]);
if ((await desktop.inputValue('[name="service"]')) !== "Custom Software Development") issues.push("Cross-page service inquiry did not prefill Contact.");

await waitForPage(desktop, pageDefinitions[3]);
await desktop.locator('[data-solution="automate"]').scrollIntoViewIfNeeded();
await desktop.waitForTimeout(760);
await desktop.click('[data-solution="automate"]');
await desktop.waitForTimeout(240);
if (!(await desktop.locator("[data-solution-title]").textContent()).includes("Otomatiskan")) issues.push("Solution explorer did not update.");

await waitForPage(desktop, pageDefinitions[2]);
const introVisual = desktop.locator(".page-intro [data-scene-visual]");
await desktop.locator(".page-intro").hover({ position: { x: 400, y: 260 } });
await desktop.waitForTimeout(120);
const introShift = await introVisual.evaluate((element) => ({
  x: element.style.getPropertyValue("--visual-shift-x"),
  y: element.style.getPropertyValue("--visual-shift-y")
}));
if (!introShift.x || introShift.x === "0px" || !introShift.y || introShift.y === "0px") issues.push("Prototype intro did not respond to pointer depth.");

const previewCarouselState = { sequence: [] };
const readActivePreview = () => desktop.locator('[data-preview-slide][data-position="0"]').getAttribute("data-preview-project");
const hoverSwipePreview = async (page, direction) => {
  const previewBounds = await page.locator("[data-preview-carousel]").boundingBox();
  if (!previewBounds) return;
  const y = previewBounds.y + previewBounds.height * 0.52;
  await page.mouse.move(previewBounds.x + previewBounds.width * 0.6, y);
  await page.mouse.wheel(direction === "right" ? -120 : 120, 0);
  await page.waitForTimeout(820);
};

previewCarouselState.sequence.push(await readActivePreview());
await hoverSwipePreview(desktop, "right");
previewCarouselState.sequence.push(await readActivePreview());
await desktop.screenshot({ path: join(output, "prototype-carousel-rag.png"), fullPage: false });
await hoverSwipePreview(desktop, "right");
previewCarouselState.sequence.push(await readActivePreview());
await desktop.screenshot({ path: join(output, "prototype-carousel-faceswap.png"), fullPage: false });
await hoverSwipePreview(desktop, "right");
previewCarouselState.sequence.push(await readActivePreview());
await desktop.screenshot({ path: join(output, "prototype-carousel-cctv.png"), fullPage: false });
await hoverSwipePreview(desktop, "left");
previewCarouselState.leftSwipe = await readActivePreview();
await hoverSwipePreview(desktop, "right");
await hoverSwipePreview(desktop, "right");
previewCarouselState.returnedTo = await readActivePreview();
previewCarouselState.visibleControls = await desktop.locator("[data-preview-previous], [data-preview-next], [data-preview-dot], [data-preview-count]").count();
if (previewCarouselState.sequence.join(",") !== "erp,rag,faceswap,cctv") issues.push(`Prototype carousel order failed: ${previewCarouselState.sequence.join(",")}.`);
if (previewCarouselState.leftSwipe !== "faceswap" || previewCarouselState.returnedTo !== "erp") issues.push(`Prototype swipe directions or looping failed: ${JSON.stringify(previewCarouselState)}.`);
if (previewCarouselState.visibleControls !== 0) issues.push("Prototype carousel still exposed arrows, dots, or visual counts.");

const previewCaseOpener = desktop.locator('[data-preview-slide][data-position="0"] [data-preview-open]');
await previewCaseOpener.click();
await desktop.locator("#case-dialog").waitFor({ state: "visible" });
previewCarouselState.openedCase = (await desktop.locator("[data-case-title]").textContent())?.trim();
if (previewCarouselState.openedCase !== "Platform Operasional ERP Modular") issues.push(`Active prototype image opened the wrong details: ${previewCarouselState.openedCase}.`);
await desktop.click("[data-close-case]");
if (!(await previewCaseOpener.evaluate((element) => element === document.activeElement))) issues.push("Prototype detail dialog did not restore focus to its image.");

await desktop.locator(".client-band").scrollIntoViewIfNeeded();
await desktop.waitForTimeout(760);
const clientState = await desktop.evaluate(() => ({
  heading: document.querySelector("#clients-title")?.textContent.trim() || "",
  logos: [...document.querySelectorAll("[data-client-logo]")].map((logo) => ({
    alt: logo.alt,
    complete: logo.complete,
    naturalWidth: logo.naturalWidth,
    naturalHeight: logo.naturalHeight
  }))
}));
if (clientState.heading !== "Klien Kami") issues.push("Prototype Work did not expose the localized client heading.");
if (clientState.logos.length !== 4 || clientState.logos.some((logo) => !logo.complete || !logo.naturalWidth || !logo.naturalHeight)) {
  issues.push(`Client logos did not load correctly: ${JSON.stringify(clientState.logos)}.`);
}
await desktop.screenshot({ path: join(output, "client-band-desktop.png"), fullPage: false });

const expectedFilterCounts = { "business-systems": 1, "generative-ai": 2, "computer-vision": 2, all: 4 };
for (const [filter, expected] of Object.entries(expectedFilterCounts)) {
  await desktop.click(`[data-filter="${filter}"]`);
  const visibleProjects = await desktop.locator("[data-project]:not(.is-hidden)").count();
  if (visibleProjects !== expected) issues.push(`${filter} filter showed ${visibleProjects} projects instead of ${expected}.`);
}
const erpCard = desktop.locator('[data-project="erp"]');
await erpCard.hover({ position: { x: 480, y: 90 } });
await desktop.waitForTimeout(180);
const cardTransform = await erpCard.locator(".project-open").evaluate((element) => getComputedStyle(element).transform);
if (!cardTransform || cardTransform === "none") issues.push("Prototype card did not respond with a 3D transform.");
await desktop.mouse.move(0, 0);
await erpCard.locator('[data-open-case="erp"]').click();
if ((await desktop.locator("[data-gallery-total]").textContent()) !== "3") issues.push("ERP gallery image count is incorrect.");
await desktop.click("[data-gallery-next]");
await desktop.keyboard.press("ArrowRight");
if ((await desktop.locator("[data-gallery-current]").textContent()) !== "3") issues.push("Gallery click and keyboard navigation failed.");
await desktop.click("[data-close-case]");
if (!(await erpCard.locator('[data-open-case="erp"]').evaluate((element) => element === document.activeElement))) issues.push("Gallery did not restore focus.");
await desktop.click('[data-project="cctv"] [data-open-case="cctv"]');
if (await desktop.locator("[data-gallery-next]").isVisible()) issues.push("Single-image gallery still exposed navigation.");
await desktop.click("[data-close-case]");

await waitForPage(desktop, pageDefinitions[4]);
await desktop.click('[data-process="2"]');
await desktop.waitForTimeout(220);
if (!(await desktop.locator("[data-process-title]").textContent()).includes("Bangun secara bertahap")) issues.push("Process explorer did not update.");

await waitForPage(desktop, pageDefinitions[5]);
await desktop.click(".accordion-item:nth-child(2) button");
if (!(await desktop.locator(".accordion-item:nth-child(2)").evaluate((item) => item.classList.contains("is-open")))) issues.push("About FAQ did not open.");

await desktop.goto(`${baseUrl}/contact?service=ERP%20Development`, { waitUntil: "networkidle" });
if ((await desktop.inputValue('[name="service"]')) !== "ERP Development") issues.push("Direct Contact query did not prefill the service.");
await desktop.fill('[name="name"]', "Uji Visual");
await desktop.fill('[name="company"]', "Perusahaan Contoh");
await desktop.fill('[name="email"]', "visual@example.com");
await desktop.click("[data-form-next]");
if (!(await desktop.locator('[data-form-step="2"]').isVisible())) issues.push("Inquiry form did not advance to step two.");
await desktop.fill('[name="brief"]', "Konteks konsultasi E2E ini cukup panjang untuk melewati validasi.");
await desktop.check('[name="consent"]');
await desktop.click("[data-submit-button]");
await desktop.locator("[data-form-success]").waitFor({ state: "visible" });
if (!submittedInquiry || submittedInquiry.service !== "ERP Development" || submittedInquiry.consent !== true) issues.push("Inquiry form did not submit its complete payload.");
if ((await desktop.locator("[data-inquiry-id]").textContent()) !== "INQ-E2E-TEST") issues.push("Inquiry reference was not rendered.");

const responsive = {};
for (const viewport of [
  { name: "wide", width: 1920, height: 1080 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 }
]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
  await markEntrySeen(page);
  attachDiagnostics(page, viewport.name);
  responsive[viewport.name] = {};
  for (const definition of pageDefinitions) {
    await waitForPage(page, definition);
    const metrics = await page.evaluate(() => {
      const heading = document.querySelector("main h1");
      const marker = document.querySelector("[data-scene-visual]");
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        headingLeft: heading ? Math.round(heading.getBoundingClientRect().left) : 0,
        headingRight: heading ? Math.round(heading.getBoundingClientRect().right) : 0,
        visualWidth: marker ? Math.round(marker.getBoundingClientRect().width) : 0
      };
    });
    responsive[viewport.name][definition.key] = metrics;
    if (metrics.scrollWidth > metrics.clientWidth) issues.push(`${definition.path} ${viewport.name} overflow: ${metrics.scrollWidth}/${metrics.clientWidth}.`);
    if (metrics.headingLeft < -1 || metrics.headingRight > metrics.clientWidth + 1) issues.push(`${definition.path} ${viewport.name} heading escaped the viewport.`);
    if (definition.key !== "contact" && metrics.visualWidth === 0) issues.push(`${definition.path} ${viewport.name} lost its visual focus.`);
    if (["laptop", "mobile"].includes(viewport.name)) await page.screenshot({ path: join(output, `page-${definition.key}-${viewport.name}.png`), fullPage: false });
    if (definition.key === "prototype-work" && ["laptop", "mobile"].includes(viewport.name)) {
      await page.locator(".client-band").scrollIntoViewIfNeeded();
      await page.waitForTimeout(760);
      await page.screenshot({ path: join(output, `client-band-${viewport.name}.png`), fullPage: false });
    }
  }

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  if (viewport.name === "wide" || viewport.name === "mobile") {
    await page.waitForFunction(() => document.querySelector("[data-product-scene]")?.classList.contains("is-webgl-ready"), null, { timeout: 10000 });
    const signal = await readCanvasSignal(page);
    if (!signal.ready || signal.litSamples < (viewport.name === "mobile" ? 100 : 250) || signal.spread < 30) issues.push(`${viewport.name} 3D canvas was blank: ${JSON.stringify(signal)}`);
  }
  await page.close();
}

const mobileMenuPage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
attachDiagnostics(mobileMenuPage, "mobile-menu");
await mobileMenuPage.goto(`${baseUrl}/solutions`, { waitUntil: "networkidle" });
await mobileMenuPage.click("[data-menu-toggle]");
await mobileMenuPage.waitForTimeout(320);
const mobileMenu = await mobileMenuPage.locator("[data-mobile-menu]").evaluate((element) => {
  const style = getComputedStyle(element);
  const bounds = element.getBoundingClientRect();
  return { background: style.backgroundColor, opacity: style.opacity, visibility: style.visibility, top: Math.round(bounds.top), bottom: Math.round(bounds.bottom), active: element.querySelector("[aria-current='page']")?.getAttribute("href") };
});
if (mobileMenu.opacity !== "1" || mobileMenu.visibility !== "visible" || mobileMenu.bottom < 843) issues.push("Mobile menu did not cover the viewport.");
if (mobileMenu.active !== "/solutions") issues.push("Mobile menu did not show the current page.");
await mobileMenuPage.screenshot({ path: join(output, "mobile-menu.png"), fullPage: false });
await mobileMenuPage.close();

const reducedMotionPage = await browser.newPage({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" });
await markEntrySeen(reducedMotionPage);
attachDiagnostics(reducedMotionPage, "reduced-motion");
await reducedMotionPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
await reducedMotionPage.waitForFunction(() => document.querySelector("[data-product-scene]")?.classList.contains("is-webgl-ready"), null, { timeout: 10000 });
const reducedMotionState = await reducedMotionPage.evaluate(() => ({
  allRevealsVisible: [...document.querySelectorAll("[data-reveal]")].every((element) => element.classList.contains("is-visible")),
  heroTransform: getComputedStyle(document.querySelector("[data-product-scene]")).transform
}));
if (!reducedMotionState.allRevealsVisible || reducedMotionState.heroTransform !== "none") issues.push(`Reduced-motion state failed: ${JSON.stringify(reducedMotionState)}`);
await reducedMotionPage.goto(`${baseUrl}/prototype-work`, { waitUntil: "networkidle" });
await hoverSwipePreview(reducedMotionPage, "right");
const reducedCarouselState = await reducedMotionPage.evaluate(() => ({
  active: document.querySelector('[data-preview-slide][data-position="0"]')?.dataset.previewProject,
  transition: Number.parseFloat(getComputedStyle(document.querySelector("[data-preview-slide]")).transitionDuration)
}));
if (reducedCarouselState.active !== "rag" || reducedCarouselState.transition > 0.001) issues.push(`Reduced-motion carousel failed: ${JSON.stringify(reducedCarouselState)}`);
await reducedMotionPage.close();

const legalPage = await browser.newPage({ viewport: { width: 1366, height: 900 }, deviceScaleFactor: 1 });
attachDiagnostics(legalPage, "legal");
for (const legalPath of ["/privacy", "/terms"]) {
  await legalPage.goto(`${baseUrl}${legalPath}`, { waitUntil: "networkidle" });
  if ((await legalPage.getAttribute("html", "lang")) !== "id") issues.push(`${legalPath} is not explicitly Indonesian.`);
}
await legalPage.close();
await desktop.close();
await browser.close();

console.log(JSON.stringify({ firstVisitState, homeAfterEntry, desktopPages, desktopCanvasSignal, homeStructure, shellPriority, transitionState, introShift, previewCarouselState, clientState, responsive, mobileMenu, reducedMotionState, reducedCarouselState, issues }, null, 2));
if (issues.length) process.exitCode = 1;
