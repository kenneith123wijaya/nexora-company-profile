import { randomUUID } from "node:crypto";
import { JWT } from "google-auth-library";

const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;
const PROVIDER_TIMEOUT_MS = 5_000;
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const requestsByAddress = globalThis.__nexoraInquiryRateLimits || new Map();
globalThis.__nexoraInquiryRateLimits = requestsByAddress;

const serviceOptions = new Set([
  "ERP Development",
  "Website Development",
  "Custom Software Development",
  "Artificial Intelligence",
  "Dashboard and Analytics",
  "System Integration",
  "Other"
]);
const serviceLabels = new Map([
  ["ERP Development", "Pengembangan ERP"],
  ["Website Development", "Pengembangan Situs Web"],
  ["Custom Software Development", "Pengembangan Perangkat Lunak Khusus"],
  ["Artificial Intelligence", "Kecerdasan Buatan"],
  ["Dashboard and Analytics", "Dasbor dan Analitik"],
  ["System Integration", "Integrasi Sistem"],
  ["Other", "Lainnya"]
]);

const attachmentTypes = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

const cleanText = (value, maxLength = 2500) =>
  typeof value === "string" ? value.replaceAll("\0", "").trim().slice(0, maxLength) : "";

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

const json = (payload, status = 200) =>
  Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });

const validateInquiry = (body) => {
  const record = {
    name: cleanText(body.name, 100),
    company: cleanText(body.company, 120),
    email: cleanText(body.email, 180).toLowerCase(),
    whatsapp: cleanText(body.whatsapp, 30),
    service: cleanText(body.service, 80),
    businessType: cleanText(body.businessType, 80),
    budget: cleanText(body.budget, 80),
    timeline: cleanText(body.timeline, 80),
    brief: cleanText(body.brief, 2500),
    consent: body.consent === true,
    website: cleanText(body.website, 200)
  };

  const errors = {};
  if (record.name.length < 2) errors.name = "Mohon masukkan nama Anda.";
  if (record.company.length < 2) errors.company = "Mohon masukkan nama perusahaan Anda.";
  if (!validEmail(record.email)) errors.email = "Mohon masukkan alamat email yang valid.";
  if (record.whatsapp && !/^[+0-9()\-\s]{7,24}$/.test(record.whatsapp)) errors.whatsapp = "Mohon masukkan nomor WhatsApp yang valid.";
  if (!serviceOptions.has(record.service)) errors.service = "Mohon pilih layanan yang valid.";
  if (record.brief.length < 20) errors.brief = "Mohon berikan konteks proyek minimal 20 karakter.";
  if (!record.consent) errors.consent = "Persetujuan diperlukan sebelum konsultasi dapat diproses.";

  return { valid: Object.keys(errors).length === 0, errors, record };
};

const withinRateLimit = (address) => {
  const now = Date.now();
  const recent = (requestsByAddress.get(address) || []).filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    requestsByAddress.set(address, recent);
    return false;
  }
  recent.push(now);
  requestsByAddress.set(address, recent);
  return true;
};

const validAttachmentSignature = (buffer, extension) => {
  if (extension === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (extension === "doc") return buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1";
  if (extension === "docx") return buffer.subarray(0, 2).toString("ascii") === "PK";
  return false;
};

const prepareAttachment = (attachment) => {
  if (!attachment) return null;
  const filename = cleanText(attachment.name, 160);
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !attachmentTypes[extension] || typeof attachment.data !== "string") throw new Error("INVALID_ATTACHMENT");
  if (attachment.type && attachment.type !== "application/octet-stream" && attachment.type !== attachmentTypes[extension]) {
    throw new Error("INVALID_ATTACHMENT");
  }
  const buffer = Buffer.from(attachment.data, "base64");
  if (!buffer.length || buffer.length > MAX_ATTACHMENT_SIZE || !validAttachmentSignature(buffer, extension)) {
    throw new Error("INVALID_ATTACHMENT");
  }
  if (Number(attachment.size) && Math.abs(Number(attachment.size) - buffer.length) > 4) throw new Error("INVALID_ATTACHMENT");
  return { filename, content: buffer.toString("base64") };
};

const makeInquiryId = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `INQ-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
};

const serviceLabel = (service) => serviceLabels.get(service) || service;

const formatInquiryEmail = (record) => [
  `Konsultasi situs web baru: ${record.id}`,
  "",
  `Nama: ${record.name}`,
  `Perusahaan: ${record.company}`,
  `Email: ${record.email}`,
  `WhatsApp: ${record.whatsapp || "Tidak diberikan"}`,
  `Layanan: ${serviceLabel(record.service)}`,
  `Jenis bisnis: ${record.businessType || "Tidak diberikan"}`,
  `Anggaran: ${record.budget || "Tidak diberikan"}`,
  `Target waktu: ${record.timeline || "Tidak diberikan"}`,
  "",
  "Konteks proyek:",
  record.brief,
  "",
  `Dikirim: ${record.submittedAt}`
].join("\n");

const sendEmail = async (payload, { fetchImpl = fetch, idempotencyKey } = {}) => {
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`EMAIL_PROVIDER_${response.status}`);
};

const getCalendarConfig = () => ({
  clientEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || "",
  privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replaceAll("\\n", "\n").trim() || "",
  calendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || "",
  timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE?.trim() || "Asia/Jakarta"
});

const calendarIsConfigured = (config = getCalendarConfig()) =>
  Boolean(config.clientEmail && config.privateKey && config.calendarId);

const defaultGetAccessToken = async (config) => {
  const client = new JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: [CALENDAR_SCOPE]
  });
  const credentials = await client.getAccessToken();
  if (!credentials.token) throw new Error("CALENDAR_TOKEN_MISSING");
  return credentials.token;
};

export const buildCalendarEvent = (record) => {
  const start = new Date(new Date(record.submittedAt).getTime() + 60 * 60 * 1_000);
  const end = new Date(start.getTime() + 30 * 60 * 1_000);
  const timeZone = getCalendarConfig().timeZone;
  return {
    summary: `[Konsultasi baru] ${record.company} - ${serviceLabel(record.service)}`,
    description: [
      `Konsultasi: ${record.id}`,
      `Nama: ${record.name}`,
      `Perusahaan: ${record.company}`,
      `Email: ${record.email}`,
      `WhatsApp: ${record.whatsapp || "Tidak diberikan"}`,
      `Layanan: ${serviceLabel(record.service)}`,
      `Target waktu: ${record.timeline || "Tidak diberikan"}`,
      "",
      "Konteks proyek:",
      record.brief
    ].join("\n"),
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    visibility: "private",
    transparency: "opaque",
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 30 },
        { method: "popup", minutes: 10 }
      ]
    },
    extendedProperties: { private: { inquiryId: record.id } }
  };
};

export const createCalendarFollowUp = async (
  record,
  { fetchImpl = fetch, getAccessToken = defaultGetAccessToken } = {}
) => {
  const config = getCalendarConfig();
  if (!calendarIsConfigured(config)) return { configured: false, created: false };
  const accessToken = await getAccessToken(config);
  const response = await fetchImpl(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(buildCalendarEvent(record)),
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    }
  );
  if (!response.ok) throw new Error(`CALENDAR_PROVIDER_${response.status}`);
  const event = await response.json().catch(() => ({}));
  return { configured: true, created: true, eventId: event.id || null };
};

export const handleInquiry = async (request, dependencies = {}) => {
  if (request.method !== "POST") return json({ message: "Metode tidak diizinkan." }, 405);

  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) return json({ message: "Asal permintaan tidak diizinkan." }, 403);

  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!withinRateLimit(address)) return json({ message: "Terlalu banyak konsultasi dikirim. Silakan coba lagi nanti." }, 429);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Permintaan konsultasi tidak memiliki format JSON yang valid." }, 400);
  }

  const { valid, errors, record } = validateInquiry(body || {});
  if (record.website) return json({ id: makeInquiryId(), stored: true }, 201);
  if (!valid) return json({ message: "Periksa kembali detail konsultasi yang ditandai.", errors }, 422);

  if (!process.env.RESEND_API_KEY || !process.env.INQUIRY_TO_EMAIL) {
    return json({ message: "Pengiriman email konsultasi belum dikonfigurasi." }, 503);
  }

  let attachment;
  try {
    attachment = prepareAttachment(body.attachment);
  } catch {
    return json({ message: "Lampiran harus berupa PDF, DOC, atau DOCX yang valid dengan ukuran maksimal 2 MB." }, 422);
  }

  const savedRecord = {
    id: makeInquiryId(),
    submittedAt: new Date().toISOString(),
    ...record,
    website: undefined
  };
  const fromEmail = process.env.INQUIRY_FROM_EMAIL || "Studio Sistem Digital <onboarding@resend.dev>";
  const adminEmail = {
    from: fromEmail,
    to: [process.env.INQUIRY_TO_EMAIL],
    reply_to: savedRecord.email,
    subject: `[${savedRecord.id}] Konsultasi ${serviceLabel(savedRecord.service)} dari ${savedRecord.company}`,
    text: formatInquiryEmail(savedRecord)
  };
  if (attachment) adminEmail.attachments = [attachment];
  const sendEmailImpl = dependencies.sendEmail || sendEmail;
  const createCalendarImpl = dependencies.createCalendarFollowUp || createCalendarFollowUp;

  try {
    await sendEmailImpl(adminEmail, { idempotencyKey: `${savedRecord.id}-admin` });
  } catch (error) {
    console.error("Email konsultasi admin gagal:", error.message);
    return json({ message: "Konsultasi tidak dapat dikirim. Silakan hubungi kami langsung melalui email." }, 502);
  }

  const [confirmationResult, calendarResult] = await Promise.allSettled([
    sendEmailImpl({
      from: fromEmail,
      to: [savedRecord.email],
      subject: `Kami telah menerima konsultasi proyek Anda (${savedRecord.id})`,
      text: [
        `Halo ${savedRecord.name},`,
        "",
        "Terima kasih telah membagikan konteks proyek Anda. Konsultasi Anda telah diterima dan akan kami tinjau sebelum merekomendasikan langkah lanjutan yang tepat.",
        "",
        `Referensi: ${savedRecord.id}`,
        `Layanan: ${serviceLabel(savedRecord.service)}`,
        "",
        "Studio Sistem Digital"
      ].join("\n")
    }, { idempotencyKey: `${savedRecord.id}-confirmation` }),
    createCalendarImpl(savedRecord)
  ]);

  if (confirmationResult.status === "rejected") {
    console.error(`Konfirmasi pelanggan gagal untuk ${savedRecord.id}:`, confirmationResult.reason?.message || "TIDAK_DIKETAHUI");
  }
  if (calendarResult.status === "rejected") {
    console.error(`Tindak lanjut kalender gagal untuk ${savedRecord.id}:`, calendarResult.reason?.message || "TIDAK_DIKETAHUI");
  }

  const calendarConfigured = calendarResult.status === "fulfilled"
    ? calendarResult.value.configured
    : calendarIsConfigured();
  return json({
    id: savedRecord.id,
    stored: true,
    notificationDelivered: true,
    confirmationDelivered: confirmationResult.status === "fulfilled",
    calendarConfigured,
    calendarEventCreated: calendarResult.status === "fulfilled" && calendarResult.value.created
  }, 201);
};

export default {
  fetch: handleInquiry
};
