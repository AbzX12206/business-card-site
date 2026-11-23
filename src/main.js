import "@fontsource-variable/inter";
import "./style.css";

import { SITE } from "./site.config.js";
import { createContext, renderBlock } from "./blocks.js";
import { buildTelegramText, formatPhone, validateLead } from "./lead.js";
import { describeStatus, getOpenStatus } from "./hours.js";
import { getConsent, isConfigured, loadAnalytics, setConsent, track } from "./analytics.js";

/* ════════════════════════════════════════════════════════════════════
   Режимы отправки заявки (выбирается автоматически, по приоритету):
     1. SITE.leadEndpoint / VITE_LEAD_ENDPOINT → POST на ваш сервер (functions/api/lead.js).
        Токен бота остаётся на сервере. РЕКОМЕНДУЕМЫЙ режим.
     2. VITE_TELEGRAM_BOT_TOKEN + VITE_TELEGRAM_CHAT_ID → прямой вызов Bot API из браузера.
        Токен виден всем посетителям: только для тестов (см. README, «Безопасность»).
     3. Иначе демо-режим: 600 мс «отправка» и сообщение об успехе.
   ──────────────────────────────────────────────────────────────────── */
const LEAD_ENDPOINT = import.meta.env.VITE_LEAD_ENDPOINT || SITE.leadEndpoint || "";
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID || "";
const SIMULATED_DELAY_MS = 600;
const REQUEST_TIMEOUT_MS = 10000;
const LANG_KEY = "lang";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═════════════ Язык ═════════════ */

const state = { ctx: createContext(SITE.defaultLocale), onLocale: [] };

function pickInitialLocale() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && SITE.locales.includes(saved)) return saved;
  } catch {
    /* хранилище недоступно */
  }
  const preferred = (navigator.languages?.length ? navigator.languages : [navigator.language]).filter(Boolean);
  for (const tag of preferred) {
    const base = String(tag).toLowerCase().split("-")[0];
    if (SITE.locales.includes(base)) return base;
  }
  return SITE.defaultLocale;
}

/** Применяет язык ко всей странице: тексты, атрибуты, блоки, <title>, meta. */
function applyLocale(locale) {
  const ctx = createContext(locale);
  state.ctx = ctx;
  const { tr } = ctx;

  document.documentElement.lang = ctx.locale;
  document.title = tr("meta.title");
  $('meta[name="description"]')?.setAttribute("content", tr("meta.description"));
  $('meta[property="og:title"]')?.setAttribute("content", tr("meta.ogTitle"));
  $('meta[property="og:description"]')?.setAttribute("content", tr("meta.ogDescription"));
  $('meta[property="og:image:alt"]')?.setAttribute("content", tr("meta.ogAlt"));

  // Блоки: перерисовываем целиком, сохраняя выбранную услугу в форме.
  const select = $("#lead-service");
  const selected = select?.value ?? "";
  $$("[data-block]").forEach((el) => {
    el.innerHTML = renderBlock(el.dataset.block, ctx);
  });
  if (select) select.value = selected;

  $$("[data-i18n]").forEach((el) => {
    el.textContent = tr(el.dataset.i18n);
  });
  $$("[data-i18n-attr]").forEach((el) => {
    el.dataset.i18nAttr.split(";").forEach((pair) => {
      const i = pair.indexOf(":");
      if (i > 0) el.setAttribute(pair.slice(0, i).trim(), tr(pair.slice(i + 1).trim()));
    });
  });

  const menuButton = $("#menu-toggle");
  const menu = $("#mobile-menu");
  if (menuButton && menu) menuButton.setAttribute("aria-label", tr(menu.hidden ? "ui.menuOpen" : "ui.menuClose"));

  updateOpenStatus();
  state.onLocale.forEach((fn) => fn(ctx));
}

function initLanguage() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-lang]");
    if (!button) return;
    const locale = button.dataset.lang;
    if (!SITE.locales.includes(locale) || locale === state.ctx.locale) return;
    try {
      localStorage.setItem(LANG_KEY, locale);
    } catch {
      /* не критично */
    }
    applyLocale(locale);
  });
  const initial = pickInitialLocale();
  if (initial !== SITE.defaultLocale) applyLocale(initial);
}

/* ═════════════ Бейдж «Открыто сейчас» ═════════════ */

function updateOpenStatus() {
  const badges = $$("[data-open-status]");
  if (!badges.length) return;
  let text = "";
  let open = false;
  try {
    const status = getOpenStatus(SITE.hours, new Date(), SITE.timezone);
    open = status.open;
    text = describeStatus(status, state.ctx.dict, state.ctx.locale);
  } catch {
    text = "";
  }
  badges.forEach((el) => {
    el.hidden = !text;
    el.dataset.state = open ? "open" : "closed";
    el.textContent = text;
  });
}

function initOpenStatus() {
  updateOpenStatus();
  setInterval(updateOpenStatus, 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) updateOpenStatus();
  });
}

/* ═════════════ Навигация ═════════════ */

/** Мобильное меню: aria-expanded, Esc, клик вне меню, закрытие по ссылке и при переходе на десктоп. */
function initMenu() {
  const button = $("#menu-toggle");
  const menu = $("#mobile-menu");
  if (!button || !menu) return;
  const iconOpen = $("[data-icon-open]", button);
  const iconClose = $("[data-icon-close]", button);

  const setOpen = (open) => {
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", state.ctx.tr(open ? "ui.menuClose" : "ui.menuOpen"));
    iconOpen?.classList.toggle("hidden", open);
    iconClose?.classList.toggle("hidden", !open);
  };

  button.addEventListener("click", () => setOpen(menu.hidden));
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) setOpen(false);
  });
  window.matchMedia("(min-width: 1024px)").addEventListener("change", (event) => {
    if (event.matches) setOpen(false);
  });
}

/** Плавная прокрутка к якорям с учётом sticky-шапки (scroll-padding) и переносом фокуса. */
function scrollToTarget(target, focusSelector) {
  const reduced = prefersReducedMotion();
  target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });

  const focusTarget = focusSelector ? $(focusSelector) : target;
  if (!focusTarget) return;
  if (!focusSelector) focusTarget.setAttribute("tabindex", "-1");
  // Фокус после прокрутки, чтобы экранная клавиатура не дёргала страницу посреди анимации.
  setTimeout(() => focusTarget.focus({ preventScroll: true }), reduced ? 0 : 450);
}

function initSmoothScroll() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute("href");
    if (!hash || hash === "#") return;
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (!target) return;
    event.preventDefault();
    scrollToTarget(target, link.dataset.focus);
    history.pushState(null, "", hash);
  });
}

/** «Select Service»: подставляет услугу (по id) в форму и прокручивает к ней. */
function initServicePrefill() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-service]");
    const select = $("#lead-service");
    const contact = $("#contact");
    if (!button || !select || !contact) return;
    const option = Array.from(select.options).find((o) => o.value === button.dataset.service);
    if (option) select.value = option.value;
    scrollToTarget(contact, "#lead-name");
    history.pushState(null, "", "#contact");
  });
}

/** FAQ (делегирование: переживает перерисовку при смене языка). */
function initAccordion() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".faq-trigger");
    if (!trigger) return;
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    if (!panel) return;
    const open = trigger.getAttribute("aria-expanded") !== "true";
    trigger.setAttribute("aria-expanded", String(open));
    panel.dataset.open = String(open);
  });

  document.addEventListener("keydown", (event) => {
    const trigger = event.target.closest?.(".faq-trigger");
    if (!trigger) return;
    const triggers = $$(".faq-trigger", trigger.closest("[data-accordion]"));
    const index = triggers.indexOf(trigger);
    const keys = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: triggers.length - 1 };
    if (!(event.key in keys)) return;
    event.preventDefault();
    triggers[(keys[event.key] + triggers.length) % triggers.length].focus();
  });
}

function initPrivacyDialog() {
  const dialog = $("#privacy-dialog");
  if (!dialog) return;
  const root = document.documentElement;

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-privacy]")) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      root.classList.add("modal-open");
    } else if (event.target.closest("[data-close-privacy]")) {
      dialog.close();
    } else if (event.target === dialog) {
      dialog.close(); // клик по затемнению
    }
  });
  dialog.addEventListener("close", () => root.classList.remove("modal-open"));
}

/* ═════════════ Аналитика и согласие ═════════════ */

function initAnalytics() {
  const cfg = SITE.analytics;
  const banner = $("#consent");
  const reopen = $$("[data-open-consent]");
  if (!isConfigured(cfg)) return; // ничего не загружаем и баннер не показываем

  reopen.forEach((el) => (el.hidden = false));
  const showBanner = () => banner && (banner.hidden = false);
  const consent = getConsent();
  if (consent === "granted") loadAnalytics(cfg);
  else if (consent === null) showBanner();

  document.addEventListener("click", (event) => {
    const choice = event.target.closest("[data-consent]");
    if (choice) {
      setConsent(choice.dataset.consent);
      if (banner) banner.hidden = true;
      if (choice.dataset.consent === "granted") loadAnalytics(cfg);
      return;
    }
    if (event.target.closest("[data-open-consent]")) showBanner();

    const goal = event.target.closest("[data-track]")?.dataset.track;
    if (goal) track(goal, cfg);
  });
}

/* ═════════════ Отправка заявки ═════════════ */

async function postJson(url, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** @returns {Promise<void>} бросает Error с полем code: "rate" | "send" */
async function sendLead(lead) {
  const { ctx } = state;
  const payload = { ...lead, locale: ctx.locale, pageUrl: window.location.href };

  if (LEAD_ENDPOINT) {
    const response = await postJson(LEAD_ENDPOINT, payload);
    if (response.status === 429) throw Object.assign(new Error("rate limited"), { code: "rate" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) throw Object.assign(new Error(`Lead endpoint status ${response.status}`), { code: "send" });
    return;
  }

  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    // Владельцу сообщение приходит на ownerLocale, а не на языке посетителя.
    const owner = createContext(SITE.ownerLocale);
    const serviceTitle = lead.service ? owner.dict.services.items[lead.service]?.title ?? lead.service : "";
    const response = await postJson(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      chat_id: TELEGRAM_CHAT_ID,
      text: buildTelegramText(payload, {
        siteName: SITE.name,
        serviceTitle,
        pageUrl: payload.pageUrl,
        timezone: SITE.timezone,
      }),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    const data = await response.json().catch(() => null);
    // Только статус: URL содержит токен, в логи его не пускаем.
    if (!response.ok || !data || data.ok !== true) throw Object.assign(new Error(`Telegram API status ${response.status}`), { code: "send" });
    return;
  }

  // Демо-режим: секретов нет, данные формы остаются в консоли.
  console.info("[lead] Demo mode (no endpoint, no Telegram). Payload:", payload);
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
}

/* ═════════════ Форма ═════════════ */

function initForm() {
  const form = $("#lead-form");
  if (!form) return;

  const country = form.dataset.country || SITE.phone.country;
  const serviceIds = SITE.services.map((s) => s.id);
  const status = $("#form-status", form);
  const submit = $("#lead-submit", form);
  const label = $("[data-submit-label]", form);
  const spinner = $("[data-spinner]", form);
  let busy = false;
  let fieldErrors = {};

  const fields = {
    name: { input: $("#lead-name", form), error: $("#lead-name-error", form), msg: "form.errorName" },
    phone: { input: $("#lead-phone", form), error: $("#lead-phone-error", form), msg: "form.errorPhone" },
  };

  const renderErrors = () => {
    Object.entries(fields).forEach(([key, { input, error, msg }]) => {
      const message = fieldErrors[key] ? state.ctx.tr(msg) : "";
      input.setAttribute("aria-invalid", message ? "true" : "false");
      error.textContent = message;
      error.hidden = !message;
    });
  };
  state.onLocale.push(renderErrors);

  const hideStatus = () => {
    status.hidden = true;
    status.replaceChildren();
    delete status.dataset.state;
  };

  const showStatus = (kind, message, { fallback = false } = {}) => {
    status.replaceChildren();
    status.dataset.state = kind;
    const text = document.createElement("p");
    text.textContent = message;
    status.append(text);

    if (fallback) {
      const links = document.createElement("p");
      links.className = "mt-1";
      const call = document.createElement("a");
      call.href = `tel:${SITE.phone.e164}`;
      call.textContent = SITE.phone.display;
      const wa = document.createElement("a");
      wa.href = `https://wa.me/${SITE.whatsapp}`;
      wa.target = "_blank";
      wa.rel = "noopener noreferrer";
      wa.textContent = "WhatsApp";
      links.append(call, document.createTextNode(" · "), wa);
      status.append(links);
    }
    status.hidden = false;
  };

  const setBusy = (value) => {
    busy = value;
    submit.disabled = value;
    submit.setAttribute("aria-busy", String(value));
    spinner.hidden = !value;
    label.textContent = state.ctx.tr(value ? "form.sending" : "form.submit");
  };

  // Маска телефона по правилам страны из SITE.phone.country
  fields.phone.input.addEventListener("input", () => {
    fields.phone.input.value = formatPhone(fields.phone.input.value, country);
  });

  // Ошибка исчезает, когда человек начинает исправлять поле
  Object.entries(fields).forEach(([key, { input }]) =>
    input.addEventListener("input", () => {
      delete fieldErrors[key];
      renderErrors();
    }),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    hideStatus();
    const { tr } = state.ctx;

    const data = new FormData(form);
    const lead = {
      name: String(data.get("name") || ""),
      phone: String(data.get("phone") || ""),
      service: String(data.get("service") || ""),
      notes: String(data.get("notes") || ""),
    };

    // Honeypot: бот заполнил скрытое поле. Имитируем успех и ничего не отправляем.
    if (String(data.get("website") || "").trim() !== "") {
      showStatus("success", tr("form.successAnon"));
      form.reset();
      return;
    }

    fieldErrors = validateLead(lead, { country, serviceIds });
    renderErrors();
    const firstInvalid = fieldErrors.name ? fields.name.input : fieldErrors.phone ? fields.phone.input : null;
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    setBusy(true);
    try {
      await sendLead(lead);
      const firstName = lead.name.trim().split(/\s+/)[0];
      form.reset();
      showStatus("success", tr("form.success", { firstName }));
      status.focus();
      track("lead", SITE.analytics);
    } catch (error) {
      console.error("[lead] delivery failed:", error instanceof Error ? error.message : "unknown error");
      const key = !navigator.onLine ? "form.errorOffline" : error?.code === "rate" ? "form.errorRate" : "form.errorSend";
      showStatus("error", tr(key), { fallback: true });
    } finally {
      setBusy(false);
    }
  });
}

function init() {
  initMenu();
  initSmoothScroll();
  initServicePrefill();
  initAccordion();
  initPrivacyDialog();
  initForm();
  initOpenStatus();
  initAnalytics();
  initLanguage();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
}
