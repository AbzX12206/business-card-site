/**
 * Аналитика с согласием посетителя. Пока согласия нет (или оно отклонено), ни один
 * сторонний скрипт не загружается и cookie не ставятся.
 * ID задаются в SITE.analytics. Пустые значения = система отключена.
 */
const STORAGE_KEY = "consent.analytics";

const ID_RULES = {
  yandexMetrika: /^\d{4,12}$/,
  ga4: /^G-[A-Z0-9]{4,14}$/,
  metaPixel: /^\d{6,20}$/,
};

/** Только валидные ID: значение попадает в URL скрипта и в код-инициализатор. */
export function activeProviders(cfg = {}) {
  return Object.keys(ID_RULES).filter((key) => ID_RULES[key].test(String(cfg[key] ?? "")));
}

export const isConfigured = (cfg) => activeProviders(cfg).length > 0;

export function getConsent() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* приватный режим: решение действует до закрытия страницы */
  }
}

const addScript = (src) => {
  const el = document.createElement("script");
  el.async = true;
  el.src = src;
  document.head.append(el);
};

let loaded = false;

/** Загружает счётчики один раз. Вызывать только после согласия. */
export function loadAnalytics(cfg) {
  if (loaded || typeof document === "undefined") return;
  loaded = true;
  const on = activeProviders(cfg);

  if (on.includes("yandexMetrika")) {
    const id = Number(cfg.yandexMetrika);
    window.ym =
      window.ym ||
      function (...args) {
        (window.ym.a = window.ym.a || []).push(args);
      };
    window.ym.l = Date.now();
    addScript("https://mc.yandex.ru/metrika/tag.js");
    window.ym(id, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true });
  }

  if (on.includes("ga4")) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", cfg.ga4);
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(cfg.ga4)}`);
  }

  if (on.includes("metaPixel")) {
    const queue = [];
    window.fbq = function (...args) {
      queue.push(args);
      if (window.fbq.loaded) window.fbq.callMethod?.(...args);
    };
    window.fbq.queue = queue;
    addScript("https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", cfg.metaPixel);
    window.fbq("track", "PageView");
  }
}

const GOALS = {
  call: { ga4: "click_call", meta: "Contact" },
  whatsapp: { ga4: "click_whatsapp", meta: "Contact" },
  map: { ga4: "click_map", meta: null },
  lead: { ga4: "generate_lead", meta: "Lead" },
};

/** Событие-цель во все подключённые системы. Без согласия ничего не делает. */
export function track(goal, cfg) {
  if (!loaded || !GOALS[goal]) return;
  const g = GOALS[goal];
  try {
    if (cfg.yandexMetrika && window.ym) window.ym(Number(cfg.yandexMetrika), "reachGoal", goal);
    if (cfg.ga4 && window.gtag) window.gtag("event", g.ga4);
    if (cfg.metaPixel && window.fbq && g.meta) window.fbq("track", g.meta);
  } catch {
    /* аналитика не должна ломать сайт */
  }
}
