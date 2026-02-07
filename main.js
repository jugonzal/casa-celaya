const DEFAULT_LANG = "es";
const SUPPORTED_LANGS = new Set(["es", "en"]);

const state = {
  content: null,
  lang: DEFAULT_LANG,
  categoryKey: null,
  imageIndex: 0,
  isLightboxOpen: false,
  lastSubmitAt: 0,
  submitting: false,
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function $all(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

function getLangFromUrl() {
  const url = new URL(window.location.href);
  const lang = url.searchParams.get("lang");
  if (lang && SUPPORTED_LANGS.has(lang)) return lang;
  return null;
}

function getLangFromStorage() {
  try {
    const lang = localStorage.getItem("cc_lang");
    if (lang && SUPPORTED_LANGS.has(lang)) return lang;
  } catch {
    // ignore
  }
  return null;
}

function setLangInUrl(lang, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  if (replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

function setLangInStorage(lang) {
  try {
    localStorage.setItem("cc_lang", lang);
  } catch {
    // ignore
  }
}

function trackEvent(name, props = {}) {
  const payload = {
    event: name,
    ...props,
  };

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push(payload);
    return;
  }

  // eslint-disable-next-line no-console
  console.debug("[event]", payload);
}

function getLocalized() {
  return state.content[state.lang];
}

function getProperty() {
  return state.content.property;
}

function updateMeta() {
  const t = getLocalized();
  const p = getProperty();

  document.documentElement.lang = state.lang;

  document.title = t.metaTitle;
  setMeta("name", "description", t.metaDescription);

  setMeta("property", "og:title", t.metaTitle);
  setMeta("property", "og:description", t.metaDescription);
  setMeta("property", "og:image", p.shareImageUrl || p.heroFallbackAbsolute || "");
  setMeta("property", "og:url", canonicalUrl());

  setMeta("name", "twitter:title", t.metaTitle);
  setMeta("name", "twitter:description", t.metaDescription);
  setMeta("name", "twitter:image", p.shareImageUrl || p.heroFallbackAbsolute || "");

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute("href", canonicalUrl());

  const ld = $("#ld-json");
  if (ld) {
    const listing = {
      "@context": "https://schema.org",
      "@type": "Residence",
      name: t.schemaName,
      description: t.metaDescription,
      address: {
        "@type": "PostalAddress",
        addressLocality: p.addressLocality,
        addressRegion: p.addressRegion,
        addressCountry: p.addressCountry,
      },
      numberOfRooms: p.facts?.beds ?? undefined,
    };
    ld.textContent = JSON.stringify(listing);
  }
}

function canonicalUrl() {
  const p = getProperty();
  const base = (p.siteUrl || window.location.origin + window.location.pathname).replace(/\/$/, "");
  return `${base}/?lang=${state.lang}`;
}

function setMeta(attrName, attrValue, content) {
  const sel = `meta[${attrName}="${attrValue}"]`;
  const el = document.querySelector(sel);
  if (el) el.setAttribute("content", content ?? "");
}

function applyI18n() {
  const t = getLocalized();
  $all("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    if (!key) return;
    if (typeof t[key] === "string") node.textContent = t[key];
  });

  $all("[data-i18n-aria]").forEach((node) => {
    const key = node.getAttribute("data-i18n-aria");
    if (!key) return;
    if (typeof t[key] === "string") node.setAttribute("aria-label", t[key]);
  });

  // placeholders
  const time = $("#time");
  if (time) time.setAttribute("placeholder", t.formPreferredTimePlaceholder);
}

function applyBindings() {
  const p = getProperty();
  const t = getLocalized();

  $all("[data-bind]").forEach((node) => {
    const path = node.getAttribute("data-bind");
    if (!path) return;
    const value = path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), p);
    node.textContent = value ?? "—";
  });

  // hero alt text
  const hero = $("#heroImage");
  if (hero) hero.alt = t.heroAlt;
}

function setLanguage(lang, { replaceUrl = false } = {}) {
  if (!SUPPORTED_LANGS.has(lang)) lang = DEFAULT_LANG;
  state.lang = lang;

  setLangInStorage(lang);
  setLangInUrl(lang, { replace: replaceUrl });

  $all(".lang__btn").forEach((btn) => {
    const isActive = btn.getAttribute("data-lang") === lang;
    btn.setAttribute("aria-pressed", String(isActive));
  });

  applyI18n();
  applyBindings();
  renderWhy();
  renderGalleryTabs();
  renderDetails();
  renderDownloads();
  renderNearby();
  wireContactLinks();
  updateMeta();
}

function ensureDefaultCategory() {
  const categories = getProperty().gallery?.categories || [];
  if (!categories.length) {
    state.categoryKey = null;
    return;
  }

  if (!state.categoryKey || !categories.some((c) => c.key === state.categoryKey)) {
    state.categoryKey = categories[0].key;
    state.imageIndex = 0;
  }
}

function currentCategory() {
  const categories = getProperty().gallery?.categories || [];
  return categories.find((c) => c.key === state.categoryKey) || categories[0];
}

function galleryCategories() {
  const categories = getProperty().gallery?.categories || [];
  return categories.filter((c) => (c.images || []).length > 0);
}

function resolveCategoryIndex(categories) {
  if (!categories.length) return 0;
  const idx = categories.findIndex((c) => c.key === state.categoryKey);
  return idx >= 0 ? idx : 0;
}

function nextGalleryPosition(delta) {
  const categories = galleryCategories();
  if (!categories.length) return null;

  let catIdx = resolveCategoryIndex(categories);
  let imgIdx = Math.max(0, Math.min(state.imageIndex, (categories[catIdx].images || []).length - 1));

  const steps = Math.abs(delta);
  for (let i = 0; i < steps; i += 1) {
    if (delta > 0) {
      if (imgIdx < categories[catIdx].images.length - 1) imgIdx += 1;
      else {
        catIdx = (catIdx + 1) % categories.length;
        imgIdx = 0;
      }
    } else if (delta < 0) {
      if (imgIdx > 0) imgIdx -= 1;
      else {
        catIdx = (catIdx - 1 + categories.length) % categories.length;
        imgIdx = categories[catIdx].images.length - 1;
      }
    }
  }

  return { categoryKey: categories[catIdx].key, imageIndex: imgIdx };
}

function stepGallery(delta, { renderLightbox = false } = {}) {
  const next = nextGalleryPosition(delta);
  if (!next) return;

  if (next.categoryKey !== state.categoryKey) setCategory(next.categoryKey);

  if (renderLightbox) renderLightbox(next.imageIndex);
  else setHeroIndex(next.imageIndex);
}

function currentImages() {
  return currentCategory()?.images || [];
}

function setCategory(key) {
  state.categoryKey = key;
  state.imageIndex = 0;
  renderGalleryTabs();
  renderThumbStrip();
  renderHeroImage();
  renderGalleryGrid();
}

function setHeroIndex(index) {
  const imgs = currentImages();
  if (!imgs.length) return;
  const clamped = Math.max(0, Math.min(index, imgs.length - 1));
  state.imageIndex = clamped;
  renderHeroImage();
  renderThumbStrip();
}

function imageUrl(img) {
  return img?.src || "";
}

function imageCaption(img) {
  const t = getLocalized();
  if (!img) return "";
  if (state.lang === "en") return img.caption_en || "";
  return img.caption_es || img.caption || t.captionFallback;
}

function renderGalleryTabs() {
  const el = $(".galleryTabs");
  if (!el) return;
  const categories = getProperty().gallery?.categories || [];
  const t = getLocalized();

  el.innerHTML = "";

  categories.forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", String(c.key === state.categoryKey));
    btn.textContent = t.galleryCategoryLabels[c.key] || c.label || c.key;
    btn.addEventListener("click", () => setCategory(c.key));
    el.appendChild(btn);
  });
}

function renderHeroImage() {
  const hero = $("#heroImage");
  if (!hero) return;
  const imgs = currentImages();
  const img = imgs[state.imageIndex] || imgs[0];

  if (!img) {
    hero.removeAttribute("src");
    return;
  }

  hero.src = imageUrl(img);
  hero.loading = "eager";
}

function renderThumbStrip() {
  const strip = $("#thumbStrip");
  if (!strip) return;
  const imgs = currentImages();
  const t = getLocalized();

  strip.innerHTML = "";

  imgs.forEach((img, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "thumb";
    btn.setAttribute("aria-label", `${t.thumbLabel} ${idx + 1}`);
    btn.setAttribute("aria-current", String(idx === state.imageIndex));

    const image = document.createElement("img");
    image.src = imageUrl(img);
    image.alt = img.alt || t.heroAlt;
    image.loading = idx < 6 ? "eager" : "lazy";
    image.decoding = "async";

    btn.appendChild(image);
    btn.addEventListener("click", () => setHeroIndex(idx));

    strip.appendChild(btn);
  });
}

function renderGalleryGrid() {
  const grid = $("#galleryGrid");
  if (!grid) return;
  const imgs = currentImages();
  const t = getLocalized();

  grid.innerHTML = "";

  imgs.slice(0, 12).forEach((img, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "cardImg";

    const image = document.createElement("img");
    image.src = imageUrl(img);
    image.alt = img.alt || t.heroAlt;
    image.loading = "lazy";
    image.decoding = "async";

    wrap.appendChild(image);
    wrap.addEventListener("click", () => openLightbox(idx));

    grid.appendChild(wrap);
  });
}

function renderWhy() {
  const ul = $("#whyBullets");
  if (!ul) return;
  const t = getLocalized();
  ul.innerHTML = "";

  (t.whyBullets || []).forEach((txt) => {
    const li = document.createElement("li");
    li.textContent = txt;
    ul.appendChild(li);
  });
}

function renderDetails() {
  const chips = $("#detailChips");
  if (!chips) return;
  const t = getLocalized();
  chips.innerHTML = "";

  (t.detailChips || []).forEach((txt) => {
    const c = document.createElement("span");
    c.className = "chip";
    c.textContent = txt;
    chips.appendChild(c);
  });
}

function renderNearby() {
  const cards = $("#nearbyCards");
  if (!cards) return;
  const t = getLocalized();

  cards.innerHTML = "";
  (t.nearby || []).forEach((n) => {
    const card = document.createElement("div");
    card.className = "nearby";

    const title = document.createElement("div");
    title.className = "nearby__t";
    title.textContent = n.title;

    const desc = document.createElement("div");
    desc.className = "nearby__d";
    desc.textContent = n.desc;

    card.appendChild(title);
    card.appendChild(desc);
    cards.appendChild(card);
  });
}

function renderDownloads() {
  const wrap = $("#downloadLinks");
  if (!wrap) return;
  const t = getLocalized();
  const p = getProperty();

  wrap.innerHTML = "";

  (p.downloads || []).forEach((d) => {
    const a = document.createElement("a");
    a.className = "btn btn--ghost";
    a.href = d.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = t.downloadLabels[d.key] || d.label || d.key;
    wrap.appendChild(a);
  });
}

function wireMap() {
  const p = getProperty();
  const frame = $("#mapFrame");
  if (!frame) return;
  frame.src = p.mapEmbedUrl || "";
}

function waHref() {
  const p = getProperty();
  const t = getLocalized();

  const num = (p.contact?.whatsappNumber || "").replace(/\D/g, "");
  const msg = t.whatsappPrefill.replace("{property}", t.headline).replace("{url}", canonicalUrl());
  const encoded = encodeURIComponent(msg);

  if (!num) return "#";
  return `https://wa.me/${num}?text=${encoded}`;
}

function callHref() {
  const p = getProperty();
  const num = p.contact?.phoneNumber || "";
  if (!num) return "#";
  return `tel:${num}`;
}

function wireContactLinks() {
  const wa = waHref();
  const tel = callHref();

  ["#whatsappLink", "#whatsappLinkTop", "#whatsappLinkSticky"].forEach((sel) => {
    const a = $(sel);
    if (!a) return;
    a.href = wa;
    a.addEventListener("click", () => trackEvent("whatsapp_click", { lang: state.lang }));
  });

  ["#callLink", "#callLinkTop"].forEach((sel) => {
    const a = $(sel);
    if (!a) return;
    a.href = tel;
    a.addEventListener("click", () => trackEvent("call_click", { lang: state.lang }));
  });
}

function openLightbox(index = 0) {
  const lb = $("#lightbox");
  if (!lb) return;
  state.isLightboxOpen = true;
  lb.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  renderLightbox(index);

  // focus close button
  $("#lbClose")?.focus();
}

function closeLightbox() {
  const lb = $("#lightbox");
  if (!lb) return;
  state.isLightboxOpen = false;
  lb.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function renderLightbox(index) {
  const imgs = currentImages();
  if (!imgs.length) return;

  const idx = Math.max(0, Math.min(index, imgs.length - 1));
  state.imageIndex = idx;

  const img = imgs[idx];
  const el = $("#lbImg");
  if (el) {
    el.src = imageUrl(img);
    el.alt = img.alt || getLocalized().heroAlt;
  }

  const cap = $("#lbCaption");
  if (cap) cap.textContent = imageCaption(img);

  const thumbs = $("#lbThumbs");
  if (thumbs) {
    thumbs.innerHTML = "";
    imgs.forEach((timg, tidx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-current", String(tidx === idx));

      const ti = document.createElement("img");
      ti.src = imageUrl(timg);
      ti.alt = timg.alt || getLocalized().heroAlt;
      ti.loading = "lazy";
      ti.decoding = "async";

      b.appendChild(ti);
      b.addEventListener("click", () => renderLightbox(tidx));
      thumbs.appendChild(b);
    });
  }
}

function stepLightbox(delta) {
  stepGallery(delta, { renderLightbox: true });
}

function wireLightbox() {
  $("#openLightbox")?.addEventListener("click", () => openLightbox(state.imageIndex));
  $("#openLightbox2")?.addEventListener("click", () => openLightbox(state.imageIndex));

  $("#lbClose")?.addEventListener("click", closeLightbox);
  $("#lbPrev")?.addEventListener("click", () => stepLightbox(-1));
  $("#lbNext")?.addEventListener("click", () => stepLightbox(1));

  $("#lightbox")?.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.dataset?.close === "true") closeLightbox();
  });

  window.addEventListener("keydown", (e) => {
    if (!state.isLightboxOpen) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") stepLightbox(-1);
    if (e.key === "ArrowRight") stepLightbox(1);
  });

  // swipe
  const panel = $(".lightbox__panel");
  if (panel) {
    let x0 = 0;
    let y0 = 0;
    let active = false;

    panel.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches?.[0];
        if (!t) return;
        active = true;
        x0 = t.clientX;
        y0 = t.clientY;
      },
      { passive: true }
    );

    panel.addEventListener(
      "touchend",
      (e) => {
        if (!active) return;
        active = false;
        const t = e.changedTouches?.[0];
        if (!t) return;
        const dx = t.clientX - x0;
        const dy = t.clientY - y0;

        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) stepLightbox(1);
          else stepLightbox(-1);
        }
      },
      { passive: true }
    );
  }
}

function wireLangToggle() {
  $all(".lang__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      if (!lang) return;
      setLanguage(lang);
    });
  });

  window.addEventListener("popstate", () => {
    const lang = getLangFromUrl() || getLangFromStorage() || DEFAULT_LANG;
    setLanguage(lang, { replaceUrl: true });
  });
}

function wireHeroNav() {
  $("#heroPrev")?.addEventListener("click", () => stepGallery(-1));
  $("#heroNext")?.addEventListener("click", () => stepGallery(1));
}

function wireForm() {
  const form = $("#leadForm");
  const status = $("#formStatus");
  const submit = $("#submitBtn");
  if (!form || !status || !submit) return;

  form.addEventListener("submit", (e) => {
    const now = Date.now();

    // basic client-side rate-limit: one submit per 45s
    if (now - state.lastSubmitAt < 45_000) {
      e.preventDefault();
      status.textContent = getLocalized().formRateLimit;
      return;
    }

    if (state.submitting) {
      e.preventDefault();
      return;
    }

    state.submitting = true;
    submit.disabled = true;
    status.textContent = getLocalized().formSubmitting;

    // Let the browser submit to Netlify.
    state.lastSubmitAt = now;
    trackEvent("form_submit", { lang: state.lang, mode: "netlify" });

    // optimistic thank-you; Netlify redirects are optional.
    window.setTimeout(() => {
      status.textContent = getLocalized().formThanks;
      state.submitting = false;
      submit.disabled = false;
    }, 900);
  });
}

function wireVideo() {
  const p = getProperty();
  const section = $("#video");
  const video = $("#videoEl");
  if (!section || !video) return;

  const src = p.video?.src;
  if (!src) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  video.innerHTML = "";

  const s = document.createElement("source");
  s.src = src;
  s.type = p.video?.type || "video/mp4";
  video.appendChild(s);

  let played = false;
  video.addEventListener("play", () => {
    if (played) return;
    played = true;
    trackEvent("video_play", { lang: state.lang });
  });
}

async function init() {
  const res = await fetch("./content.json", { cache: "no-store" });
  state.content = await res.json();

  const initial = getLangFromUrl() || getLangFromStorage() || DEFAULT_LANG;

  ensureDefaultCategory();
  renderGalleryTabs();
  setCategory(currentCategory()?.key);

  wireLangToggle();
  wireLightbox();
  wireHeroNav();
  wireForm();
  wireMap();
  wireVideo();

  setLanguage(initial, { replaceUrl: true });
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
});
