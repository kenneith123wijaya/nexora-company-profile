const navigation = [
  { key: "home", label: "Beranda", href: "/" },
  { key: "prototype-work", label: "Karya Prototipe", href: "/prototype-work" },
  { key: "services", label: "Layanan", href: "/services" },
  { key: "solutions", label: "Solusi", href: "/solutions" },
  { key: "process", label: "Proses", href: "/process" },
  { key: "about", label: "Tentang", href: "/about" }
];
const entrySeenKey = "nexora.prototypeEntrySeen.v1";

export const WHATSAPP_NUMBER = "628113663435";

const whatsappServiceLabels = {
  "ERP Development": "Pengembangan ERP",
  "Website Development": "Pengembangan situs web",
  "Custom Software Development": "Pengembangan perangkat lunak khusus",
  "Artificial Intelligence": "Kecerdasan buatan",
  "Dashboard and Analytics": "Dasbor dan analitik",
  "System Integration": "Integrasi sistem",
  Other: "Kebutuhan digital lainnya"
};

export const getWhatsAppServiceLabel = (service = "") => whatsappServiceLabels[service] || service;

export const buildWhatsAppMessage = ({ service = "", project = "" } = {}) => {
  const lines = ["Halo, saya mengunjungi website Anda dan ingin berkonsultasi tentang proyek digital."];
  if (project) lines.push(`Prototipe yang saya lihat: ${project}.`);
  if (service) lines.push(`Kebutuhan yang diminati: ${getWhatsAppServiceLabel(service)}.`);
  lines.push("Mohon bantu saya menentukan langkah selanjutnya.");
  return lines.join("\n");
};

export const buildWhatsAppUrl = (context = {}) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(buildWhatsAppMessage(context))}`;

const navigationLink = (item, activePage, className = "nav-link") => {
  const active = item.key === activePage;
  return `<a class="${className}${active ? " is-active" : ""}" href="${item.href}"${active ? ' aria-current="page"' : ""}>${item.label}</a>`;
};

export const mountSiteShell = () => {
  const activePage = document.body.dataset.page || "home";
  const headerHost = document.querySelector("[data-site-header]");
  const footerHost = document.querySelector("[data-site-footer]");
  const whatsappUrl = buildWhatsAppUrl();

  if (activePage === "prototype-work") {
    try {
      window.localStorage.setItem(entrySeenKey, "true");
    } catch {
      // Navigation remains usable when browser storage is unavailable.
    }
  }

  if (!document.querySelector("[data-page-transition]")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div class="page-transition" data-page-transition aria-hidden="true"><span></span><span></span></div>'
    );
  }

  if (headerHost) {
    headerHost.outerHTML = `
      <header class="site-header" data-header>
        <div class="header-inner shell">
          <a class="brand" href="/" aria-label="Beranda">
            <span class="brand-glyph" aria-hidden="true">N</span>
          </a>
          <nav class="desktop-nav" aria-label="Navigasi utama">
            ${navigation.map((item) => navigationLink(item, activePage)).join("")}
          </nav>
          <div class="header-actions">
            <a class="button button-small button-primary header-cta" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" data-whatsapp-link>
              <span>Chat WhatsApp</span>
              <i data-lucide="message-circle" aria-hidden="true"></i>
            </a>
            <button class="icon-button menu-toggle" type="button" data-menu-toggle data-tooltip="Buka menu" aria-label="Buka menu navigasi" aria-controls="mobile-menu" aria-expanded="false">
              <i data-lucide="menu" aria-hidden="true"></i>
            </button>
          </div>
        </div>
        <div class="mobile-menu" id="mobile-menu" data-mobile-menu aria-hidden="true">
          <nav aria-label="Navigasi seluler">
            ${navigation.map((item) => navigationLink(item, activePage, "")).join("")}
            <a class="mobile-menu-cta" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" data-whatsapp-link>Chat WhatsApp</a>
          </nav>
          <p>Sistem digital terarah untuk pekerjaan operasional nyata.</p>
        </div>
      </header>`;
  }

  if (footerHost) {
    footerHost.outerHTML = `
      <footer class="site-footer">
        <div class="shell footer-main">
          <div class="footer-brand">
            <a class="brand" href="/" aria-label="Beranda"><span class="brand-glyph" aria-hidden="true">N</span></a>
            <p>Sistem digital yang dirancang berdasarkan operasi bisnis nyata.</p>
            <span>Surabaya, Indonesia</span>
          </div>
          <div class="footer-column">
            <h2>Keahlian</h2>
            <a href="/prototype-work">Karya Prototipe</a>
            <a href="/services">Layanan</a>
            <a href="/solutions">Solusi</a>
          </div>
          <div class="footer-column">
            <h2>Perusahaan</h2>
            <a href="/process">Proses</a>
            <a href="/about">Tentang</a>
            <a href="/contact">Kontak</a>
          </div>
          <div class="footer-column footer-contact">
            <h2>Mulai dari konteks</h2>
            <p>Ceritakan kendala, alur kerja, atau ide produk yang memerlukan langkah lanjutan yang lebih jelas.</p>
            <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" data-whatsapp-link><i data-lucide="message-circle" aria-hidden="true"></i> Chat WhatsApp</a>
          </div>
        </div>
        <div class="shell footer-bottom">
          <span>&copy; <span data-current-year></span> Studio Sistem Digital. Hak cipta dilindungi.</span>
          <div><a href="/privacy">Privasi</a><a href="/terms">Ketentuan</a></div>
        </div>
      </footer>
      <a class="floating-contact" href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" data-whatsapp-link data-tooltip="Chat WhatsApp" aria-label="Mulai chat WhatsApp">
        <i data-lucide="message-circle" aria-hidden="true"></i><span>Mari bicara</span>
      </a>
      <button class="back-to-top icon-button" type="button" data-back-top data-tooltip="Kembali ke atas" aria-label="Kembali ke atas">
        <i data-lucide="arrow-up" aria-hidden="true"></i>
      </button>
      <div class="toast" role="status" aria-live="polite" data-toast></div>`;
  }
};
