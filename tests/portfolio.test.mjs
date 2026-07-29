import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { caseStudies, processData, serviceData } from "../content.js";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

test("portfolio contains the four working prototypes and expected gallery counts", async () => {
  assert.deepEqual(Object.keys(caseStudies), ["erp", "rag", "faceswap", "cctv"]);
  assert.deepEqual(
    Object.fromEntries(Object.entries(caseStudies).map(([key, project]) => [key, project.images.length])),
    { erp: 3, rag: 2, faceswap: 3, cctv: 1 }
  );

  assert.deepEqual(caseStudies.erp.categories, ["business-systems"]);
  assert.deepEqual(caseStudies.rag.categories, ["generative-ai"]);
  assert.deepEqual(caseStudies.faceswap.categories, ["generative-ai", "computer-vision"]);
  assert.deepEqual(caseStudies.cctv.categories, ["computer-vision"]);

  for (const project of Object.values(caseStudies)) {
    assert.match(project.eyebrow, /^Prototipe fungsional/);
    for (const image of project.images) {
      assert.match(image.src, /^\/assets\/work\/.+\.webp$/);
      const asset = await readFile(join(projectRoot, image.src.slice(1)));
      assert.ok(asset.length > 10_000, `${image.src} should be a real optimized asset`);
    }
  }
});

test("multi-page structure keeps focused services and delivery phases", async () => {
  assert.deepEqual(Object.keys(serviceData), ["businessSystems", "customPlatforms", "appliedAi"]);
  assert.equal(processData.length, 4);
  assert.deepEqual(processData.map((phase) => phase.index), ["01", "02", "03", "04"]);

  const canonicalServices = new Set([
    "ERP Development",
    "Dashboard and Analytics",
    "System Integration",
    "Custom Software Development",
    "Website Development",
    "Artificial Intelligence"
  ]);
  const localizedOfferings = new Set([
    "Pengembangan ERP",
    "Dasbor dan Analitik",
    "Integrasi Sistem",
    "Pengembangan Perangkat Lunak Khusus",
    "Pengembangan Situs Web",
    "Kecerdasan Buatan"
  ]);
  for (const category of Object.values(serviceData)) {
    assert.ok(canonicalServices.has(category.service));
    category.offerings.forEach((offering) => assert.ok(localizedOfferings.has(offering)));
  }

  const pages = {
    home: "index.html",
    services: "services.html",
    "prototype-work": "prototype-work.html",
    solutions: "solutions.html",
    process: "process.html",
    about: "about.html",
    contact: "contact.html"
  };

  for (const [page, filename] of Object.entries(pages)) {
    const html = await readFile(join(projectRoot, filename), "utf8");
    assert.match(html, new RegExp(`data-page="${page}"`));
    assert.match(html, /data-site-header/);
    assert.match(html, /data-site-footer/);
    assert.match(html, /<h1[\s>]/);
    assert.match(html, /<html lang="id">/);
  }

  const homepage = await readFile(join(projectRoot, "index.html"), "utf8");
  assert.doesNotMatch(homepage, /id="services"|id="work"|id="solutions"|id="process"|id="about"|id="contact"/);
  assert.match(homepage, /href="\/services"/);
  assert.match(homepage, /href="\/prototype-work"/);
  assert.match(homepage, /<a class="button button-primary" href="\/prototype-work">/);
  assert.ok(homepage.indexOf('href="/prototype-work"') < homepage.indexOf('href="/services"'));

  const shell = await readFile(join(projectRoot, "site-shell.js"), "utf8");
  assert.ok(shell.indexOf('key: "home"') < shell.indexOf('key: "prototype-work"'));
  assert.ok(shell.indexOf('key: "prototype-work"') < shell.indexOf('key: "services"'));
  assert.equal((shell.match(/label: "Beranda"/g) || []).length, 1);
  assert.doesNotMatch(shell, />Nexora</);

  const entryRedirect = await readFile(join(projectRoot, "entry-redirect.js"), "utf8");
  assert.match(homepage, /<script src="\/entry-redirect\.js"><\/script>/);
  assert.match(entryRedirect, /localStorage\.getItem\(entrySeenKey\)/);
  assert.match(entryRedirect, /localStorage\.setItem\(entrySeenKey, "true"\)/);
  assert.match(entryRedirect, /location\.replace\("\/prototype-work"\)/);

  const workPage = await readFile(join(projectRoot, "prototype-work.html"), "utf8");
  assert.equal((workPage.match(/data-project="/g) || []).length, 4);
  assert.equal((workPage.match(/data-preview-slide/g) || []).length, 4);
  assert.equal((workPage.match(/data-preview-open/g) || []).length, 4);
  assert.doesNotMatch(workPage, /data-preview-(?:previous|next|dot|count)/);
  assert.equal((workPage.match(/data-client-logo/g) || []).length, 4);
  assert.match(workPage, /<h2 id="clients-title">Klien Kami<\/h2>/);
  assert.match(workPage, /\/assets\/clients\/p-bakery\.webp/);
  assert.match(workPage, /\/assets\/clients\/playland\.webp/);
  assert.match(workPage, /\/assets\/clients\/pioneer\.webp/);
  assert.match(workPage, /\/assets\/clients\/jmm-salon\.webp/);
  assert.match(workPage, /01 \/ Karya Prototipe/);
  assert.ok(workPage.indexOf('data-preview-project="erp"') < workPage.indexOf('data-preview-project="rag"'));
  assert.ok(workPage.indexOf('data-preview-project="rag"') < workPage.indexOf('data-preview-project="faceswap"'));
  assert.ok(workPage.indexOf('data-preview-project="faceswap"') < workPage.indexOf('data-preview-project="cctv"'));

  for (const clientAsset of ["assets/clients/p-bakery.webp", "assets/clients/playland.webp", "assets/clients/pioneer.webp", "assets/clients/jmm-salon.webp"]) {
    const asset = await readFile(join(projectRoot, clientAsset));
    assert.ok(asset.length > 10_000, `${clientAsset} should be a real optimized client asset`);
  }

  const contactPage = await readFile(join(projectRoot, "contact.html"), "utf8");
  assert.match(contactPage, /id="inquiry-form"/);
  assert.match(contactPage, /value="ERP Development">Pengembangan ERP<\/option>/);
  assert.match(contactPage, /value="Custom Software Development">Pengembangan Perangkat Lunak Khusus<\/option>/);
  assert.doesNotMatch(homepage, /id="inquiry-form"/);

  for (const legalPage of ["privacy.html", "terms.html"]) {
    const html = await readFile(join(projectRoot, legalPage), "utf8");
    assert.match(html, /<html lang="id">/);
  }
});
