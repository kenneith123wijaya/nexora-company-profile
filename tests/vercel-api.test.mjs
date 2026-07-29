import assert from "node:assert/strict";
import test from "node:test";
import inquiry, { buildCalendarEvent, createCalendarFollowUp, handleInquiry } from "../api/inquiry.js";

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

let requestNumber = 0;
const request = (body, method = "POST") =>
  new Request("https://nexora.example/api/inquiry", {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "https://nexora.example",
      "X-Forwarded-For": `198.51.100.${++requestNumber}`
    },
    body: method === "POST" ? JSON.stringify(body) : undefined
  });

const withEnvironment = async (values, callback) => {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const savedInquiry = {
  id: "INQ-20260712-ABC12345",
  submittedAt: "2026-07-12T10:00:00.000Z",
  ...validInquiry,
  website: undefined
};

test("Vercel inquiry function rejects unsupported methods", async () => {
  const response = await inquiry.fetch(request(null, "GET"));
  assert.equal(response.status, 405);
});

test("Vercel inquiry function validates input", async () => {
  const response = await inquiry.fetch(request({ ...validInquiry, email: "invalid" }));
  const result = await response.json();
  assert.equal(response.status, 422);
  assert.ok(result.errors.email);
});

test("Vercel inquiry function reports missing email configuration", async () => {
  const previousKey = process.env.RESEND_API_KEY;
  const previousEmail = process.env.INQUIRY_TO_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.INQUIRY_TO_EMAIL;
  const response = await inquiry.fetch(request(validInquiry));
  assert.equal(response.status, 503);
  if (previousKey) process.env.RESEND_API_KEY = previousKey;
  if (previousEmail) process.env.INQUIRY_TO_EMAIL = previousEmail;
});

test("calendar event starts one hour later and lasts thirty minutes", async () => {
  await withEnvironment({ GOOGLE_CALENDAR_TIME_ZONE: "Asia/Jakarta" }, async () => {
    const event = buildCalendarEvent(savedInquiry);
    assert.equal(event.start.dateTime, "2026-07-12T11:00:00.000Z");
    assert.equal(event.end.dateTime, "2026-07-12T11:30:00.000Z");
    assert.equal(event.start.timeZone, "Asia/Jakarta");
    assert.equal(event.visibility, "private");
    assert.equal(event.transparency, "opaque");
    assert.deepEqual(event.reminders.overrides, [
      { method: "email", minutes: 30 },
      { method: "popup", minutes: 10 }
    ]);
    assert.match(event.description, /INQ-20260712-ABC12345/);
    assert.match(event.description, /Konteks proyek:/);
    assert.doesNotMatch(event.description, /attachment|consent/i);
  });
});

test("calendar integration reports incomplete configuration without making a request", async () => {
  await withEnvironment({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: undefined,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: undefined,
    GOOGLE_CALENDAR_ID: undefined
  }, async () => {
    let requested = false;
    const result = await createCalendarFollowUp(savedInquiry, {
      fetchImpl: async () => {
        requested = true;
        return new Response();
      }
    });
    assert.deepEqual(result, { configured: false, created: false });
    assert.equal(requested, false);
  });
});

test("calendar integration creates a private follow-up on the configured calendar", async () => {
  await withEnvironment({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "nexora-calendar@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "line-one\\nline-two",
    GOOGLE_CALENDAR_ID: "nexora inquiries@example.com",
    GOOGLE_CALENDAR_TIME_ZONE: "Asia/Jakarta"
  }, async () => {
    let tokenConfig;
    const result = await createCalendarFollowUp(savedInquiry, {
      getAccessToken: async (config) => {
        tokenConfig = config;
        return "test-access-token";
      },
      fetchImpl: async (url, options) => {
        assert.match(url, /nexora%20inquiries%40example\.com\/events$/);
        assert.equal(options.headers.Authorization, "Bearer test-access-token");
        const event = JSON.parse(options.body);
        assert.equal(event.extendedProperties.private.inquiryId, savedInquiry.id);
        assert.equal(event.visibility, "private");
        return Response.json({ id: "calendar-event-1" });
      }
    });
    assert.equal(tokenConfig.privateKey, "line-one\nline-two");
    assert.deepEqual(result, { configured: true, created: true, eventId: "calendar-event-1" });
  });
});

test("successful inquiry sends admin email before best-effort follow-ups", async () => {
  await withEnvironment({
    RESEND_API_KEY: "test-resend-key",
    INQUIRY_TO_EMAIL: "owner@gmail.com",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "calendar@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "private-key",
    GOOGLE_CALENDAR_ID: "calendar-id"
  }, async () => {
    const emailCalls = [];
    let calendarRecord;
    const attachment = Buffer.from("%PDF-test");
    const response = await handleInquiry(request({
      ...validInquiry,
      attachment: {
        name: "brief.pdf",
        type: "application/pdf",
        size: attachment.length,
        data: attachment.toString("base64")
      }
    }), {
      sendEmail: async (payload, options) => emailCalls.push({ payload, options }),
      createCalendarFollowUp: async (record) => {
        calendarRecord = record;
        return { configured: true, created: true, eventId: "event-1" };
      }
    });
    const result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.notificationDelivered, true);
    assert.equal(result.confirmationDelivered, true);
    assert.equal(result.calendarConfigured, true);
    assert.equal(result.calendarEventCreated, true);
    assert.equal(emailCalls.length, 2);
    assert.equal(emailCalls[0].payload.to[0], "owner@gmail.com");
    assert.equal(emailCalls[0].payload.attachments.length, 1);
    assert.equal(emailCalls[1].payload.attachments, undefined);
    assert.match(emailCalls[0].options.idempotencyKey, /-admin$/);
    assert.match(emailCalls[1].options.idempotencyKey, /-confirmation$/);
    assert.equal(calendarRecord.attachment, undefined);
    assert.equal(calendarRecord.consent, true);
  });
});

test("calendar and confirmation failures do not reject a delivered admin inquiry", async () => {
  await withEnvironment({
    RESEND_API_KEY: "test-resend-key",
    INQUIRY_TO_EMAIL: "owner@gmail.com",
    GOOGLE_SERVICE_ACCOUNT_EMAIL: "calendar@example.iam.gserviceaccount.com",
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: "private-key",
    GOOGLE_CALENDAR_ID: "calendar-id"
  }, async () => {
    let emailNumber = 0;
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await handleInquiry(request(validInquiry), {
        sendEmail: async () => {
          emailNumber += 1;
          if (emailNumber === 2) throw new Error("CONFIRMATION_DOWN");
        },
        createCalendarFollowUp: async () => {
          throw new Error("CALENDAR_DOWN");
        }
      });
      const result = await response.json();
      assert.equal(response.status, 201);
      assert.equal(result.notificationDelivered, true);
      assert.equal(result.confirmationDelivered, false);
      assert.equal(result.calendarConfigured, true);
      assert.equal(result.calendarEventCreated, false);
    } finally {
      console.error = originalError;
    }
  });
});

test("admin email failure rejects the inquiry before calendar creation", async () => {
  await withEnvironment({ RESEND_API_KEY: "test-resend-key", INQUIRY_TO_EMAIL: "owner@gmail.com" }, async () => {
    let calendarCalled = false;
    const originalError = console.error;
    console.error = () => {};
    try {
      const response = await handleInquiry(request(validInquiry), {
        sendEmail: async () => {
          throw new Error("ADMIN_EMAIL_DOWN");
        },
        createCalendarFollowUp: async () => {
          calendarCalled = true;
          return { configured: true, created: true };
        }
      });
      assert.equal(response.status, 502);
      assert.equal(calendarCalled, false);
    } finally {
      console.error = originalError;
    }
  });
});
