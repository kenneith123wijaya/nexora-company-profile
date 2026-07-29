import assert from "node:assert/strict";
import test from "node:test";
import { app, validateInquiry } from "../dev-server.mjs";

const validInquiry = {
  name: "Ari Wijaya",
  company: "Example Manufacturing",
  email: "ari@example.com",
  whatsapp: "+62 812 3456 7890",
  service: "ERP Development",
  businessType: "Manufacturing",
  budget: "Need guidance",
  timeline: "Within 3 months",
  brief: "We need to connect purchasing, production, inventory, and finance workflows.",
  consent: true,
  website: ""
};

test("valid inquiry data is normalized and accepted", () => {
  const result = validateInquiry(validInquiry);
  assert.equal(result.valid, true);
  assert.equal(result.record.email, "ari@example.com");
  assert.deepEqual(result.errors, {});
});

test("required and invalid inquiry fields are rejected", () => {
  const result = validateInquiry({ ...validInquiry, email: "invalid", service: "Unknown", brief: "short", consent: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.email);
  assert.ok(result.errors.service);
  assert.ok(result.errors.brief);
  assert.ok(result.errors.consent);
});

test("the static server delivers the homepage with security headers", async (context) => {
  await new Promise((resolve) => app.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve) => app.close(resolve)));
  const address = app.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  assert.match(html, /Lihat produk yang bekerja/);

  const servicesResponse = await fetch(`http://127.0.0.1:${address.port}/services`);
  const servicesHtml = await servicesResponse.text();
  assert.equal(servicesResponse.status, 200);
  assert.match(servicesHtml, /data-page="services"/);

  const invalidResponse = await fetch(`http://127.0.0.1:${address.port}/api/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...validInquiry, email: "not-an-email" })
  });
  const invalidResult = await invalidResponse.json();
  assert.equal(invalidResponse.status, 422);
  assert.ok(invalidResult.errors.email);
});
