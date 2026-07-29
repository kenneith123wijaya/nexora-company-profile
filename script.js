import {
  caseStudies as portfolioCaseStudies,
  processData as processContent,
  serviceData as serviceContent,
  solutionData as solutionContent,
  uiText
} from "./content.js";
import { mountSiteShell } from "./site-shell.js";

document.documentElement.classList.add("has-js");
document.body.classList.add("is-page-entering");
mountSiteShell();

const t = (source, parameters = {}) =>
  Object.entries(parameters).reduce(
    (result, [key, replacement]) => result.replaceAll(`{${key}}`, String(replacement)),
    String(source || "")
  );

(() => {
  "use strict";

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => (context ? [...context.querySelectorAll(selector)] : []);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let pageEntryFinished = false;
  const finishPageEntry = () => {
    if (pageEntryFinished) return;
    pageEntryFinished = true;
    document.body.classList.add("is-page-ready");
    document.body.classList.remove("is-page-entering");
  };

  if (reduceMotion) finishPageEntry();
  else {
    window.requestAnimationFrame(() => window.requestAnimationFrame(finishPageEntry));
    window.setTimeout(finishPageEntry, 120);
  }

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.protocol !== window.location.protocol) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

    event.preventDefault();
    document.body.classList.add("is-page-leaving");
    window.setTimeout(() => window.location.assign(destination.href), reduceMotion ? 0 : 300);
  });

  const renderIcons = () => {
    if (window.lucide?.createIcons) {
      window.lucide.createIcons({
        attrs: {
          width: "1em",
          height: "1em",
          "aria-hidden": "true"
        }
      });
    }
  };

  const setButtonContent = (button, label, icon) => {
    const text = document.createElement("span");
    const glyph = document.createElement("i");
    text.textContent = t(label);
    glyph.dataset.lucide = icon;
    glyph.setAttribute("aria-hidden", "true");
    button.replaceChildren(text, glyph);
    renderIcons();
  };

  renderIcons();

  const header = $("[data-header]");
  const menuButton = $("[data-menu-toggle]");
  const mobileMenu = $("[data-mobile-menu]");
  const progressBar = $(".scroll-progress span");
  const backToTop = $("[data-back-top]");
  const floatingContact = $(".floating-contact");
  const toast = $("[data-toast]");
  const sceneElements = $$('[data-scene]');
  let toastTimer;

  const showToast = (message, type = "info") => {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = t(message);
    toast.classList.toggle("is-error", type === "error");
    toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4600);
  };

  const setMenu = (open) => {
    if (!header || !mobileMenu || !menuButton) return;
    document.body.classList.toggle("menu-open", open);
    header.classList.toggle("menu-visible", open);
    mobileMenu.classList.toggle("is-open", open);
    mobileMenu.setAttribute("aria-hidden", String(!open));
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", t(open ? uiText.closeMenu : uiText.openMenu));
    menuButton.setAttribute("data-tooltip", t(open ? uiText.closeMenuTooltip : uiText.openMenuTooltip));
    menuButton.innerHTML = `<i data-lucide="${open ? "x" : "menu"}" aria-hidden="true"></i>`;
    renderIcons();
  };

  menuButton?.addEventListener("click", () => {
    setMenu(menuButton.getAttribute("aria-expanded") !== "true");
  });

  $$("a", mobileMenu).forEach((link) => link.addEventListener("click", () => setMenu(false)));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuButton?.getAttribute("aria-expanded") === "true") {
      setMenu(false);
      menuButton.focus();
    }
  });

  let scrollTicking = false;
  const updateSceneProgress = () => {
    const viewportCenter = window.innerHeight / 2;
    sceneElements.forEach((section) => {
      const bounds = section.getBoundingClientRect();
      const sectionCenter = bounds.top + bounds.height / 2;
      const range = Math.max(window.innerHeight, bounds.height) / 2;
      const distance = Math.min(1, Math.abs(sectionCenter - viewportCenter) / range);
      const progress = Math.min(1, Math.max(0, (viewportCenter - bounds.top) / Math.max(1, bounds.height)));
      section.style.setProperty("--scene-progress", progress.toFixed(3));
      section.style.setProperty("--scene-distance", distance.toFixed(3));
      section.style.setProperty("--scene-shift", `${((0.5 - progress) * 34).toFixed(2)}px`);
    });
  };

  const updateScrollUI = () => {
    const scrollTop = window.scrollY;
    const scrollRange = document.documentElement.scrollHeight - window.innerHeight;
    const progress = scrollRange > 0 ? scrollTop / scrollRange : 0;
    const contactSection = $("#contact");
    const contactBounds = contactSection?.getBoundingClientRect();
    const contactVisible = contactBounds ? contactBounds.top < window.innerHeight && contactBounds.bottom > 0 : false;
    if (progressBar) progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
    header?.classList.toggle("is-scrolled", scrollTop > 26);
    backToTop?.classList.toggle("is-visible", scrollTop > 720 && !contactVisible);
    floatingContact?.classList.toggle("is-visible", scrollTop > 360 && scrollRange - scrollTop > 360 && !contactVisible);
    updateSceneProgress();
    scrollTicking = false;
  };

  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(updateScrollUI);
        scrollTicking = true;
      }
    },
    { passive: true }
  );

  updateScrollUI();
  backToTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" }));

  const revealElements = $$('[data-reveal]');
  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
    sceneElements.forEach((element) => element.classList.add("is-scene-active"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            return;
          }

          const rootTop = entry.rootBounds?.top ?? 0;
          const exitedAbove = entry.boundingClientRect.bottom <= rootTop;
          entry.target.style.setProperty("--reveal-offset", exitedAbove ? "-28px" : "28px");
          entry.target.classList.remove("is-visible");
        });
      },
      { threshold: [0, 0.12], rootMargin: "-3% 0px -7%" }
    );
    revealElements.forEach((element) => revealObserver.observe(element));

    const sceneObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => entry.target.classList.toggle("is-scene-active", entry.isIntersecting));
      },
      { threshold: [0.08, 0.24], rootMargin: "-8% 0px -8%" }
    );
    sceneElements.forEach((element) => sceneObserver.observe(element));
  }

  const navLinks = $$(".desktop-nav .nav-link").filter((link) => link.getAttribute("href")?.startsWith("#"));
  const navTargets = $$('[data-section][id]');
  if ("IntersectionObserver" in window) {
    const activeSectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        navLinks.forEach((link) => {
          link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
        });
      },
      { rootMargin: "-34% 0px -54%", threshold: [0.01, 0.25, 0.5] }
    );
    navTargets.forEach((section) => activeSectionObserver.observe(section));
  }

  const hero = $(".hero");
  const heroMedia = $(".hero-media");
  const productScene = $("[data-product-scene]");
  if (productScene) {
    import("./product-scene.js")
      .then(({ initProductScene }) => initProductScene(productScene, { reduceMotion }))
      .catch(() => {});
  }
  if (!reduceMotion) {
    hero?.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const bounds = hero.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      if (heroMedia) heroMedia.style.transform = `scale(1.055) translate3d(${x * -8}px, ${y * -6}px, 0)`;
    });

    hero?.addEventListener("pointerleave", () => {
      if (heroMedia) heroMedia.style.transform = "";
    });
  }

  const previewCarousel = $("[data-preview-carousel]");
  if (previewCarousel) {
    const previewSlides = $$("[data-preview-slide]", previewCarousel);
    const previewTitle = $(".portfolio-preview-status [data-preview-title]");
    let activePreview = 0;
    let previewGesture = null;
    let previewWheelDistance = 0;
    let previewWheelLocked = false;
    let previewWheelReset = null;
    let suppressPreviewClickUntil = 0;

    const renderPreview = (nextIndex) => {
      activePreview = (nextIndex + previewSlides.length) % previewSlides.length;
      previewSlides.forEach((slide, index) => {
        const position = (index - activePreview + previewSlides.length) % previewSlides.length;
        const active = position === 0;
        slide.dataset.position = String(position);
        slide.classList.toggle("is-active", active);
        slide.setAttribute("aria-hidden", String(!active));
        const openButton = $("[data-preview-open]", slide);
        if (openButton) openButton.tabIndex = active ? 0 : -1;
      });

      const title = previewSlides[activePreview].dataset.previewTitle;
      if (previewTitle) previewTitle.textContent = title;
      previewCarousel.setAttribute("aria-label", `${title}, ${activePreview + 1} dari ${previewSlides.length}`);
    };

    const stepPreview = (direction) => renderPreview(activePreview + direction);

    previewCarousel.addEventListener(
      "wheel",
      (event) => {
        const horizontalGesture = Math.abs(event.deltaX) >= 8 && Math.abs(event.deltaX) > Math.abs(event.deltaY) * 1.15;
        if (!horizontalGesture) return;
        event.preventDefault();
        if (previewWheelLocked) return;

        previewWheelDistance += event.deltaX;
        window.clearTimeout(previewWheelReset);
        previewWheelReset = window.setTimeout(() => {
          previewWheelDistance = 0;
        }, 140);
        if (Math.abs(previewWheelDistance) < 32) return;

        stepPreview(previewWheelDistance < 0 ? 1 : -1);
        previewWheelDistance = 0;
        previewWheelLocked = true;
        window.setTimeout(() => {
          previewWheelLocked = false;
        }, 520);
      },
      { passive: false }
    );

    previewCarousel.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") stepPreview(-1);
      if (event.key === "ArrowRight") stepPreview(1);
      if (event.key === "Home") renderPreview(0);
      if (event.key === "End") renderPreview(previewSlides.length - 1);
    });

    previewCarousel.addEventListener("dragstart", (event) => event.preventDefault());
    previewCarousel.addEventListener(
      "click",
      (event) => {
        if (performance.now() >= suppressPreviewClickUntil) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true
    );
    previewCarousel.addEventListener("pointerdown", (event) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      previewGesture = { id: event.pointerId, x: event.clientX, y: event.clientY, deltaX: 0, axis: null };
      previewCarousel.classList.add("is-pressed");
    });

    previewCarousel.addEventListener("pointermove", (event) => {
      if (!previewGesture || previewGesture.id !== event.pointerId) return;
      const deltaX = event.clientX - previewGesture.x;
      const deltaY = event.clientY - previewGesture.y;
      previewGesture.deltaX = deltaX;
      if (!previewGesture.axis && Math.max(Math.abs(deltaX), Math.abs(deltaY)) > 8) {
        previewGesture.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
      }
      if (previewGesture.axis !== "x") return;
      event.preventDefault();
      if (!previewCarousel.hasPointerCapture(event.pointerId)) previewCarousel.setPointerCapture(event.pointerId);
      previewCarousel.classList.add("is-dragging");
      const drag = Math.max(-82, Math.min(82, deltaX * 0.42));
      previewCarousel.style.setProperty("--preview-drag-x", `${drag.toFixed(2)}px`);
    });

    const finishPreviewGesture = (event, allowChange) => {
      if (!previewGesture || previewGesture.id !== event.pointerId) return;
      const shouldChange = allowChange && previewGesture.axis === "x" && Math.abs(previewGesture.deltaX) >= 44;
      const direction = previewGesture.deltaX > 0 ? 1 : -1;
      if (shouldChange) {
        suppressPreviewClickUntil = performance.now() + 350;
        stepPreview(direction);
      }
      previewCarousel.classList.remove("is-pressed", "is-dragging");
      window.requestAnimationFrame(() => previewCarousel.style.setProperty("--preview-drag-x", "0px"));
      if (previewCarousel.hasPointerCapture(event.pointerId)) previewCarousel.releasePointerCapture(event.pointerId);
      previewGesture = null;
    };

    previewCarousel.addEventListener("pointerup", (event) => finishPreviewGesture(event, true));
    previewCarousel.addEventListener("pointercancel", (event) => finishPreviewGesture(event, false));
    renderPreview(0);
  }

  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    $$(".page-intro").forEach((intro) => {
      const visual = $("[data-scene-visual]", intro);
      if (!visual) return;
      intro.addEventListener("pointermove", (event) => {
        if (event.target.closest("[data-preview-carousel]")) {
          visual.style.setProperty("--visual-shift-x", "0px");
          visual.style.setProperty("--visual-shift-y", "0px");
          return;
        }
        const bounds = intro.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        visual.style.setProperty("--visual-shift-x", `${(x * 18).toFixed(2)}px`);
        visual.style.setProperty("--visual-shift-y", `${(y * 12).toFixed(2)}px`);
      });
      intro.addEventListener("pointerleave", () => {
        visual.style.setProperty("--visual-shift-x", "0px");
        visual.style.setProperty("--visual-shift-y", "0px");
      });
    });

    $$('[data-tilt]').forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        card.style.transform = `rotateX(${y * -2.2}deg) rotateY(${x * 2.2}deg) translateY(-2px)`;
      });
      card.addEventListener("pointerleave", () => {
        card.style.transform = "";
      });
    });

    $$('[data-depth-card]').forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const bounds = card.getBoundingClientRect();
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        card.style.setProperty("--card-tilt-x", `${(y * -5).toFixed(2)}deg`);
        card.style.setProperty("--card-tilt-y", `${(x * 6).toFixed(2)}deg`);
        card.style.setProperty("--card-light-x", `${((x + 0.5) * 100).toFixed(1)}%`);
        card.style.setProperty("--card-light-y", `${((y + 0.5) * 100).toFixed(1)}%`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--card-tilt-x", "0deg");
        card.style.setProperty("--card-tilt-y", "0deg");
      });
    });
  }

  const replaceDynamicIcon = (selector, name) => {
    const current = $(selector);
    if (!current || !name) return;
    const icon = document.createElement("i");
    icon.dataset.lucide = name;
    icon.setAttribute(selector.slice(1, -1), "");
    icon.setAttribute("aria-hidden", "true");
    current.replaceWith(icon);
  };

  const serviceStage = $("[data-service-stage]");
  const renderServiceOfferings = (items) => {
    const fragment = document.createDocumentFragment();
    items.forEach((label) => {
      const item = document.createElement("li");
      const icon = document.createElement("i");
      const text = document.createElement("span");
      icon.dataset.lucide = "check";
      icon.setAttribute("aria-hidden", "true");
      text.textContent = t(label);
      item.append(icon, text);
      fragment.append(item);
    });
    $("[data-service-offerings]")?.replaceChildren(fragment);
  };

  const setService = (key, button) => {
    const data = serviceContent[key];
    if (!data || button.classList.contains("is-active")) return;
    $$('[data-service-category]').forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    serviceStage.classList.add("is-changing");
    window.setTimeout(() => {
      $("[data-service-kicker]").textContent = t(data.kicker);
      $("[data-service-title]").textContent = t(data.title);
      $("[data-service-description]").textContent = t(data.description);
      replaceDynamicIcon("[data-service-icon]", data.icon);
      const cta = $("[data-service-cta]");
      cta.dataset.servicePick = data.service;
      cta.href = `/contact?service=${encodeURIComponent(data.service)}`;
      $("span", cta).textContent = t(data.cta);
      renderServiceOfferings(data.offerings);
      renderIcons();
      serviceStage.classList.remove("is-changing");
    }, reduceMotion ? 0 : 160);
  };

  $$('[data-service-category]').forEach((button) => {
    button.addEventListener("click", () => setService(button.dataset.serviceCategory, button));
  });

  const solutionStage = $("[data-solution-stage]");
  const renderWorkflowItems = (container, items) => {
    const fragment = document.createDocumentFragment();
    items.forEach(([icon, label]) => {
      const item = document.createElement("li");
      const glyph = document.createElement("i");
      const text = document.createElement("span");
      glyph.dataset.lucide = icon;
      glyph.setAttribute("aria-hidden", "true");
      text.textContent = t(label);
      item.append(glyph, text);
      fragment.append(item);
    });
    container.replaceChildren(fragment);
  };

  const setSolution = (key, button) => {
    const data = solutionContent[key];
    if (!data || button.classList.contains("is-active")) return;
    $$("[data-solution]").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });

    solutionStage.classList.add("is-changing");
    window.setTimeout(() => {
      $("[data-solution-number]").textContent = data.number;
      $("[data-solution-kicker]").textContent = t(data.kicker);
      $("[data-solution-title]").textContent = t(data.title);
      $("[data-solution-description]").textContent = t(data.description);
      $("[data-solution-outcome]").textContent = t(data.outcome);
      renderWorkflowItems($("[data-solution-before]"), data.before);
      renderWorkflowItems($("[data-solution-after]"), data.after);
      renderIcons();
      solutionStage.classList.remove("is-changing");
    }, reduceMotion ? 0 : 180);
  };

  $$("[data-solution]").forEach((button) => {
    button.addEventListener("click", () => setSolution(button.dataset.solution, button));
  });

  const caseDialog = $("#case-dialog");
  const caseImage = $("[data-case-image]");
  const caseCaption = $("[data-case-caption]");
  const caseThumbnails = $("[data-case-thumbnails]");
  const galleryPrevious = $("[data-gallery-previous]");
  const galleryNext = $("[data-gallery-next]");
  const gallerySwipe = $("[data-gallery-swipe]");
  let activeCaseKey = "";
  let activeGalleryIndex = 0;
  let caseOpener = null;
  let swipeStartX = null;

  const buildCapabilityList = (items) => {
    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = t(item);
      fragment.append(listItem);
    });
    $("[data-case-capabilities]").replaceChildren(fragment);
  };

  const preloadAdjacentCaseImages = (images, index) => {
    if (images.length < 2) return;
    [index - 1, index + 1].forEach((candidate) => {
      const image = images[(candidate + images.length) % images.length];
      const preload = new Image();
      preload.src = image.src;
    });
  };

  const renderCaseImage = (index, focusThumbnail = false) => {
    const data = portfolioCaseStudies[activeCaseKey];
    if (!data) return;
    activeGalleryIndex = (index + data.images.length) % data.images.length;
    const image = data.images[activeGalleryIndex];
    caseImage.src = image.src;
    caseImage.alt = t(image.alt);
    caseCaption.textContent = t(image.caption);
    $("[data-gallery-current]").textContent = String(activeGalleryIndex + 1);
    $("[data-gallery-total]").textContent = String(data.images.length);
    galleryPrevious.hidden = data.images.length <= 1;
    galleryNext.hidden = data.images.length <= 1;
    caseThumbnails.hidden = data.images.length <= 1;
    $$("[data-gallery-index]", caseThumbnails).forEach((thumbnail, thumbnailIndex) => {
      const active = thumbnailIndex === activeGalleryIndex;
      thumbnail.classList.toggle("is-active", active);
      thumbnail.setAttribute("aria-selected", String(active));
      thumbnail.tabIndex = active ? 0 : -1;
      if (active && focusThumbnail) thumbnail.focus();
    });
    preloadAdjacentCaseImages(data.images, activeGalleryIndex);
  };

  const buildCaseThumbnails = (images) => {
    const fragment = document.createDocumentFragment();
    images.forEach((image, index) => {
      const button = document.createElement("button");
      const thumbnail = document.createElement("img");
      button.className = "case-thumbnail";
      button.type = "button";
      button.role = "tab";
      button.dataset.galleryIndex = String(index);
      button.setAttribute("aria-label", t(uiText.viewImage, { number: index + 1, caption: t(image.caption) }));
      thumbnail.src = image.src;
      thumbnail.alt = "";
      thumbnail.loading = "lazy";
      thumbnail.decoding = "async";
      button.append(thumbnail);
      button.addEventListener("click", () => renderCaseImage(index, true));
      fragment.append(button);
    });
    caseThumbnails.replaceChildren(fragment);
  };

  const renderCaseCopy = (data) => {
    $("[data-case-eyebrow]").textContent = t(data.eyebrow);
    $("[data-case-title]").textContent = t(data.title);
    $("[data-case-summary]").textContent = t(data.summary);
    $("[data-case-problem]").textContent = t(data.problem);
    $("[data-case-solution]").textContent = t(data.solution);
    $("[data-case-result]").textContent = t(data.result);
    buildCapabilityList(data.capabilities);
  };

  const populateCase = (key, opener) => {
    const data = portfolioCaseStudies[key];
    if (!data) return;
    activeCaseKey = key;
    activeGalleryIndex = 0;
    caseOpener = opener || document.activeElement;
    renderCaseCopy(data);
    buildCaseThumbnails(data.images);
    renderCaseImage(0);
    const caseCta = $("[data-case-cta]");
    caseCta.dataset.servicePick = data.service;
    caseCta.href = `/contact?service=${encodeURIComponent(data.service)}`;
    caseDialog.showModal();
    document.body.classList.add("dialog-open");
    $("[data-close-case]").focus();
  };

  $$('[data-open-case]').forEach((button) => button.addEventListener("click", () => populateCase(button.dataset.openCase, button)));

  galleryPrevious?.addEventListener("click", () => renderCaseImage(activeGalleryIndex - 1));
  galleryNext?.addEventListener("click", () => renderCaseImage(activeGalleryIndex + 1));

  caseDialog?.addEventListener("keydown", (event) => {
    if (!caseDialog.open || !activeCaseKey) return;
    const focusThumbnail = Boolean(event.target.closest?.("[data-gallery-index]"));
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      renderCaseImage(activeGalleryIndex - 1, focusThumbnail);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      renderCaseImage(activeGalleryIndex + 1, focusThumbnail);
    }
    if (event.key === "Home") {
      event.preventDefault();
      renderCaseImage(0, focusThumbnail);
    }
    if (event.key === "End") {
      event.preventDefault();
      renderCaseImage(portfolioCaseStudies[activeCaseKey].images.length - 1, focusThumbnail);
    }
  });

  gallerySwipe?.addEventListener("pointerdown", (event) => {
    if (event.isPrimary) swipeStartX = event.clientX;
  });
  gallerySwipe?.addEventListener("pointerup", (event) => {
    if (swipeStartX === null || !event.isPrimary) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(distance) < 48) return;
    renderCaseImage(activeGalleryIndex + (distance < 0 ? 1 : -1));
  });
  gallerySwipe?.addEventListener("pointercancel", () => {
    swipeStartX = null;
  });

  const closeCase = () => {
    if (caseDialog?.open) caseDialog.close();
  };

  $("[data-close-case]")?.addEventListener("click", closeCase);
  caseDialog?.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    activeCaseKey = "";
    const opener = caseOpener;
    caseOpener = null;
    opener?.focus();
  });
  caseDialog?.addEventListener("click", (event) => {
    const bounds = caseDialog.getBoundingClientRect();
    const inside = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    if (!inside) closeCase();
  });
  $("[data-case-cta]")?.addEventListener("click", (event) => {
    caseOpener = null;
    closeCase();
  });

  const filterButtons = $$("[data-filter]");
  const applyProjectFilter = (button) => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
      item.tabIndex = active ? 0 : -1;
    });
    $$("[data-project]").forEach((project) => {
      const categories = project.dataset.category.split(/\s+/).filter(Boolean);
      project.classList.toggle("is-hidden", filter !== "all" && !categories.includes(filter));
    });
  };

  filterButtons.forEach((button, index) => {
    button.addEventListener("click", () => applyProjectFilter(button));
    button.addEventListener("keydown", (event) => {
      let nextIndex;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % filterButtons.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + filterButtons.length) % filterButtons.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = filterButtons.length - 1;
      if (nextIndex === undefined) return;
      event.preventDefault();
      filterButtons[nextIndex].focus();
      applyProjectFilter(filterButtons[nextIndex]);
    });
  });
  if (filterButtons.length) applyProjectFilter($("[data-filter].is-active") || filterButtons[0]);

  const processDetail = $(".process-detail");
  const setProcess = (index, button) => {
    const data = processContent[index];
    if (!data || button.classList.contains("is-active")) return;
    $$("[data-process]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    processDetail.classList.add("is-changing");
    window.setTimeout(() => {
      $("[data-process-index]").textContent = data.index;
      $("[data-process-kicker]").textContent = t(data.kicker);
      $("[data-process-title]").textContent = t(data.title);
      $("[data-process-description]").textContent = t(data.description);
      $("[data-process-output]").textContent = t(data.output);
      replaceDynamicIcon("[data-process-icon]", data.icon);
      renderIcons();
      processDetail.classList.remove("is-changing");
    }, reduceMotion ? 0 : 160);
  };

  $$("[data-process]").forEach((button) => {
    button.addEventListener("click", () => setProcess(Number(button.dataset.process), button));
  });

  const bindArrowNavigation = (selector) => {
    const buttons = $$(selector);
    buttons.forEach((button, index) => {
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === "ArrowLeft") next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === "ArrowRight") next = (index + 1) % buttons.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        buttons[next].focus();
        buttons[next].click();
      });
    });
  };

  bindArrowNavigation("[data-solution]");
  bindArrowNavigation("[data-service-category]");
  bindArrowNavigation("[data-filter]");
  bindArrowNavigation("[data-process]");

  $$(".accordion-item button").forEach((button) => {
    button.addEventListener("click", () => {
      const item = button.closest(".accordion-item");
      const panel = $(".accordion-panel", item);
      const opening = !item.classList.contains("is-open");
      $$(".accordion-item").forEach((otherItem) => {
        const otherButton = $("button", otherItem);
        const otherPanel = $(".accordion-panel", otherItem);
        otherItem.classList.remove("is-open");
        otherButton.setAttribute("aria-expanded", "false");
        otherPanel.hidden = true;
      });
      if (opening) {
        item.classList.add("is-open");
        button.setAttribute("aria-expanded", "true");
        panel.hidden = false;
      }
    });
  });

  const inquiryForm = $("#inquiry-form");
  const formSteps = $$("[data-form-step]");
  const formProgressLine = $("[data-form-progress-line]");
  const formProgressItems = $$("[data-progress]");
  const formSuccess = $("[data-form-success]");
  const draftKey = "nexora-inquiry-draft-v1";
  const serviceSelect = inquiryForm?.elements.service;
  const brief = inquiryForm?.elements.brief;
  const characterCount = $("[data-character-count]");
  const fileInput = $("[data-file-input]");
  const fileLabel = $("[data-file-label]");
  const consentError = $("[data-consent-error]");
  const submitButton = $("[data-submit-button]");
  let draftTimer;

  const setFormStep = (step) => {
    formSteps.forEach((element) => {
      const active = Number(element.dataset.formStep) === step;
      element.hidden = !active;
      element.classList.toggle("is-active", active);
    });
    formProgressItems.forEach((item) => item.classList.toggle("is-active", Number(item.dataset.progress) <= step));
    if (formProgressLine) formProgressLine.style.transform = `scaleX(${step === 2 ? 1 : 0})`;
  };

  const fieldMessage = (input) => {
    if (input.validity.valueMissing) return t(uiText.required);
    if (input.validity.typeMismatch) return t(uiText.email);
    if (input.validity.tooShort) return t(uiText.minimum, { count: input.minLength });
    if (input.validity.tooLong) return t(uiText.maximum, { count: input.maxLength });
    if (input.name === "whatsapp" && input.value.trim() && !/^[+0-9()\-\s]{7,24}$/.test(input.value.trim())) {
      return t(uiText.phone);
    }
    return "";
  };

  const validateField = (input) => {
    if (input.type === "checkbox") return input.checked;
    const field = input.closest(".field");
    if (!field) return true;
    const error = $(".field-error", field);
    const message = fieldMessage(input);
    field.classList.toggle("is-invalid", Boolean(message));
    if (error) error.textContent = message;
    input.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  };

  const validateStep = (step) => {
    const inputs = $$("input, select, textarea", $(`[data-form-step="${step}"]`)).filter(
      (input) => input.name !== "attachment" && input.name !== "website" && input.type !== "checkbox"
    );
    const results = inputs.map(validateField);
    let consentValid = true;
    if (step === 2) {
      consentValid = inquiryForm.elements.consent.checked;
      consentError.textContent = consentValid ? "" : t(uiText.consent);
    }
    const valid = results.every(Boolean) && consentValid;
    if (!valid) {
      const firstInvalid = inputs.find((input) => input.getAttribute("aria-invalid") === "true") || inquiryForm.elements.consent;
      firstInvalid?.focus();
    }
    return valid;
  };

  $$("input, select, textarea", inquiryForm).forEach((input) => {
    if (input.type === "file" || input.name === "website") return;
    input.addEventListener("blur", () => {
      if (input.type !== "checkbox") validateField(input);
    });
    input.addEventListener("input", () => {
      if (input.closest(".field")?.classList.contains("is-invalid")) validateField(input);
      if (input.name === "consent") consentError.textContent = "";
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(saveDraft, 320);
    });
    input.addEventListener("change", () => {
      window.clearTimeout(draftTimer);
      draftTimer = window.setTimeout(saveDraft, 120);
    });
  });

  $("[data-form-next]")?.addEventListener("click", () => {
    if (validateStep(1)) {
      setFormStep(2);
      $("[data-form-step='2'] select, [data-form-step='2'] textarea")?.focus();
    }
  });

  $("[data-form-back]")?.addEventListener("click", () => {
    setFormStep(1);
    inquiryForm.elements.name.focus();
  });

  brief?.addEventListener("input", () => {
    characterCount.textContent = String(brief.value.length);
  });

  fileInput?.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) {
      fileLabel.textContent = t(uiText.attachmentLabel);
      return;
    }
    const allowedExtensions = ["pdf", "doc", "docx"];
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!allowedExtensions.includes(extension) || file.size > 2 * 1024 * 1024) {
      fileInput.value = "";
      fileLabel.textContent = t(uiText.attachmentLabel);
      showToast(uiText.attachmentInvalid, "error");
      return;
    }
    fileLabel.textContent = file.name;
  });

  function saveDraft() {
    if (!inquiryForm) return;
    const draft = {};
    new FormData(inquiryForm).forEach((value, key) => {
      if (key !== "attachment" && key !== "website" && typeof value === "string") draft[key] = value;
    });
    draft.consent = inquiryForm.elements.consent.checked;
    try {
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      // Storage can be unavailable in strict privacy modes; the form still works.
    }
  }

  const restoreDraft = () => {
    if (!inquiryForm) return;
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (!draft) return;
      Object.entries(draft).forEach(([key, value]) => {
        const input = inquiryForm.elements[key];
        if (!input) return;
        if (input.type === "checkbox") input.checked = Boolean(value);
        else input.value = String(value);
      });
      characterCount.textContent = String(brief.value.length);
    } catch {
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // Ignore unavailable storage and continue with the successful submission.
      }
    }
  };

  restoreDraft();

  const requestedService = new URLSearchParams(window.location.search).get("service");
  if (requestedService && serviceSelect && [...serviceSelect.options].some((option) => option.value === requestedService)) {
    serviceSelect.value = requestedService;
    saveDraft();
  }

  $$('[data-service-pick]').forEach((link) => {
    link.addEventListener("click", () => {
      const value = link.dataset.servicePick;
      if (value && serviceSelect) {
        serviceSelect.value = value;
        saveDraft();
      }
    });
  });

  const fileToPayload = (file) =>
    new Promise((resolve, reject) => {
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t(uiText.attachmentUnreadable)));
      reader.onload = () => {
        const result = String(reader.result);
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          data: result.includes(",") ? result.split(",")[1] : result
        });
      };
      reader.readAsDataURL(file);
    });

  inquiryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const stepOneValid = validateStep(1);
    const stepTwoValid = validateStep(2);
    if (!stepOneValid) {
      setFormStep(1);
      validateStep(1);
      return;
    }
    if (!stepTwoValid) return;

    const originalSubmit = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.classList.add("is-loading");
    setButtonContent(submitButton, uiText.sending, "loader-circle");

    try {
      const formData = new FormData(inquiryForm);
      const payload = {};
      formData.forEach((value, key) => {
        if (key !== "attachment" && typeof value === "string") payload[key] = value.trim();
      });
      payload.consent = inquiryForm.elements.consent.checked;
      payload.attachment = await fileToPayload(fileInput.files[0]);

      const response = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(t(result.message || uiText.inquiryFailed));

      localStorage.removeItem(draftKey);
      inquiryForm.hidden = true;
      $(".form-progress").hidden = true;
      formSuccess.hidden = false;
      $("[data-inquiry-id]").textContent = result.id || t(uiText.received);
      formSuccess.focus();
      showToast(uiText.inquiryReceived);
    } catch (error) {
      saveDraft();
      showToast(`${error.message} ${t(uiText.draftSaved)}`, "error");
      submitButton.disabled = false;
      submitButton.classList.remove("is-loading");
      submitButton.innerHTML = originalSubmit;
      renderIcons();
    }
  });

  $("[data-new-inquiry]")?.addEventListener("click", () => {
    inquiryForm.reset();
    inquiryForm.hidden = false;
    $(".form-progress").hidden = false;
    formSuccess.hidden = true;
    fileLabel.textContent = t(uiText.attachmentLabel);
    characterCount.textContent = "0";
    setFormStep(1);
    submitButton.disabled = false;
    submitButton.classList.remove("is-loading");
    setButtonContent(submitButton, uiText.sendInquiry, "send");
    inquiryForm.elements.name.focus();
  });

  $("[data-current-year]")?.replaceChildren(String(new Date().getFullYear()));
})();
