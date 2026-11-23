/**
 * Повторяющиеся блоки страницы как чистые функции «данные → HTML-строка».
 * Один код работает дважды:
 *   • при сборке (build/render-template.js) рисует страницу на языке по умолчанию;
 *   • в браузере (src/main.js) перерисовывает блоки при смене языка.
 * Весь динамический текст экранируется.
 */
import { SITE } from "./site.config.js";
import { createTranslator, interpolate, globalVars } from "./i18n/index.js";
import { buildHoursRows } from "./hours.js";
import { escapeHtml, getPhoneRule } from "./lead.js";

const esc = escapeHtml;
const attr = (value) => escapeHtml(value).replace(/"/g, "&quot;");

export function createContext(locale, site = SITE) {
  const { tr, dict, locale: resolved } = createTranslator(locale, site);
  const vars = globalVars(site);
  return { site, locale: resolved, dict, tr, fmt: (text) => interpolate(text, vars) };
}

export function formatMoney(amount, locale, currency) {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

const safeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const LOCALE_LABELS = { en: "EN", ru: "RU", kk: "ҚАЗ" };

export const BLOCKS = {
  /** Карточки услуг. Кнопка «Select Service» подставляет услугу в форму (см. main.js). */
  services({ site, locale, dict, tr }) {
    const select = tr("services.select");
    return site.services
      .map((s) => {
        const item = dict.services.items[s.id];
        const title = esc(item.title);
        return `<li><article class="card flex h-full flex-col p-6">
  <h3 class="text-lg font-bold">${title}</h3>
  <p class="mt-2 text-ink-muted">${esc(item.desc)}</p>
  <div class="mt-auto flex items-end justify-between gap-3 pt-6">
    <p><span class="price-label">${esc(tr("services.from"))}</span><span class="price">${esc(formatMoney(s.price, locale, site.currency))}</span></p>
    <button type="button" class="btn btn-secondary" data-service="${attr(s.id)}" aria-label="${attr(`${select}: ${item.title}`)}">${esc(select)}</button>
  </div>
</article></li>`;
      })
      .join("\n");
  },

  /** <option> для выпадающего списка формы. value = id услуги. */
  serviceOptions({ site, dict, tr }) {
    const any = `<option value="">${esc(tr("form.serviceAny"))}</option>`;
    return [any, ...site.services.map((s) => `<option value="${attr(s.id)}">${esc(dict.services.items[s.id].title)}</option>`)].join("");
  },

  benefits({ dict, fmt }) {
    return dict.benefits.items
      .map(
        (b) => `<div class="flex flex-col border-t border-white/20 pt-5">
  <dt class="order-2 mt-2 text-base font-bold">${esc(fmt(b.title))}</dt>
  <dd class="order-1 text-5xl font-extrabold tracking-tight text-sky-300">${esc(b.big)}</dd>
  <dd class="order-3 mt-2 text-sm text-slate-300">${esc(fmt(b.text))}</dd>
</div>`,
      )
      .join("\n");
  },

  faq({ dict, fmt }) {
    return dict.faq.items
      .map((item, i) => {
        const n = i + 1;
        return `<div>
  <h3><button type="button" class="faq-trigger" id="faq-q${n}" aria-expanded="false" aria-controls="faq-a${n}">
    <span>${esc(fmt(item.q))}</span>
    <svg class="icon faq-chevron" aria-hidden="true"><use href="#i-chevron" /></svg>
  </button></h3>
  <div class="faq-panel" id="faq-a${n}" role="region" aria-labelledby="faq-q${n}" data-open="false">
    <div class="faq-panel-inner"><p>${esc(fmt(item.a))}</p></div>
  </div>
</div>`;
      })
      .join("\n");
  },

  hours({ site, locale, dict }) {
    return buildHoursRows(site.hours, dict, locale)
      .map((row) => `<dt class="font-medium text-ink-muted">${esc(row.label)}</dt><dd>${esc(row.text)}</dd>`)
      .join("");
  },

  /** Секция отзывов. Пока SITE.reviews пуст, возвращает пустую строку, и секции на странице нет. */
  reviews({ site, locale, tr }) {
    if (!site.reviews.length) return "";
    const cards = site.reviews
      .map((r) => {
        const text = r.text?.[locale] ?? r.text?.[site.defaultLocale] ?? Object.values(r.text ?? {})[0] ?? "";
        const rating = Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5 ? r.rating : 0;
        const url = r.url ? safeHttpUrl(r.url) : "";
        const source = r.source ? (url ? `<a href="${attr(url)}" target="_blank" rel="noopener noreferrer">${esc(r.source)}</a>` : esc(r.source)) : "";
        return `<li><figure class="card flex h-full flex-col p-6">
  ${rating ? `<p class="text-accent-dark" role="img" aria-label="${rating} / 5"><span aria-hidden="true">${"★".repeat(rating)}</span></p>` : ""}
  <blockquote class="mt-3 text-ink">${esc(text)}</blockquote>
  <figcaption class="mt-auto pt-4 text-sm"><strong>${esc(r.name)}</strong>${source ? ` · <span class="text-ink-muted">${source}</span>` : ""}</figcaption>
</figure></li>`;
      })
      .join("\n");
    return `<section id="reviews" class="py-section" aria-labelledby="reviews-title">
  <div class="mx-auto max-w-page px-4 sm:px-6 lg:px-8">
    <p class="eyebrow">${esc(tr("reviews.eyebrow"))}</p>
    <h2 id="reviews-title" class="section-title">${esc(tr("reviews.title"))}</h2>
    <ul class="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">${cards}</ul>
  </div>
</section>`;
  },

  /** Тело окна политики конфиденциальности. */
  privacy({ dict, fmt }) {
    const p = dict.privacy;
    return [`<p>${esc(fmt(p.intro))}</p>`, ...p.sections.map((s) => `<h3 class="font-bold text-ink">${esc(fmt(s.h))}</h3><p>${esc(fmt(s.p))}</p>`)].join("\n");
  },

  /** Кнопки переключателя языка. Пусто, если язык один. */
  langswitch({ site, locale }) {
    if (site.locales.length < 2) return "";
    return site.locales
      .map(
        (code) =>
          `<button type="button" class="lang-btn" data-lang="${attr(code)}" lang="${attr(code)}" aria-pressed="${code === locale}">${esc(LOCALE_LABELS[code] ?? code.toUpperCase())}</button>`,
      )
      .join("");
  },
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** JSON-LD для поисковиков. Только настроенные данные; "<" экранируется, чтобы не закрыть <script>. */
export function jsonLd({ site, tr }) {
  const a = site.address;
  const data = {
    "@context": "https://schema.org",
    "@type": site.schemaType,
    name: site.name,
    url: `${site.url}/`,
    image: `${site.url}/assets/og.png`,
    description: tr("meta.description"),
    telephone: site.phone.e164,
    address: {
      "@type": "PostalAddress",
      streetAddress: a.street,
      addressLocality: a.city,
      ...(a.region ? { addressRegion: a.region } : {}),
      ...(a.postalCode ? { postalCode: a.postalCode } : {}),
      addressCountry: a.country,
    },
    openingHoursSpecification: site.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days.map((d) => DAY_NAMES[d]),
      opens: h.open,
      closes: h.close,
    })),
    sameAs: [
      site.instagram && `https://instagram.com/${site.instagram}`,
      site.telegram && `https://t.me/${site.telegram}`,
    ].filter(Boolean),
  };
  return JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
}

export function renderBlock(name, ctx) {
  const block = BLOCKS[name];
  if (!block) throw new Error(`Неизвестный блок «${name}» (доступны: ${Object.keys(BLOCKS).join(", ")})`);
  return block(ctx);
}

/** Значения конфигурации для токенов {{v имя}} в index.html. */
export function siteValues(site = SITE) {
  const a = site.address;
  const addressLine = [a.street, [a.city, a.region, a.postalCode].filter(Boolean).join(", ")].filter(Boolean).join(", ");
  const mapLink =
    safeHttpUrl(site.mapLinkUrl) ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name}, ${addressLine}`)}`;
  return {
    name: site.name,
    brandMain: site.brand.main,
    brandSub: site.brand.sub,
    url: site.url,
    canonical: `${site.url}/`,
    ogImage: `${site.url}/assets/og.png`,
    phoneDisplay: site.phone.display,
    phoneE164: site.phone.e164,
    phonePlaceholder: getPhoneRule(site.phone.country).placeholder,
    country: site.phone.country,
    waUrl: `https://wa.me/${site.whatsapp}`,
    telegramUrl: site.telegram ? `https://t.me/${site.telegram}` : "",
    instagramUrl: site.instagram ? `https://instagram.com/${site.instagram}` : "",
    addressLine,
    street: a.street,
    city: a.city,
    mapLink,
    mapEmbed: safeHttpUrl(site.mapEmbedUrl),
    year: String(new Date().getFullYear()),
    locale: site.defaultLocale,
    locales: site.locales.join(","),
  };
}

/** Встроенная карта, если задан SITE.mapEmbedUrl; иначе пусто. */
BLOCKS.map = ({ site, tr }) => {
  const src = safeHttpUrl(site.mapEmbedUrl);
  if (!src) return "";
  return `<iframe class="h-64 w-full rounded-card border border-line" src="${attr(src)}" title="${attr(tr("contact.address"))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
};
