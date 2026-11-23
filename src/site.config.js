/**
 * ЕДИНЫЙ КОНФИГ КЛИЕНТА. Всё, что меняется от клиента к клиенту, лежит здесь
 * (контакты, адрес, часы, услуги, языки, аналитика) и в словарях src/i18n/*.js (тексты).
 * После правки этого файла перезапустите `npm run dev`: шаблон index.html собирается на старте.
 *
 * ВСЕ ЗНАЧЕНИЯ НИЖЕ: ДЕМО. Перед запуском замените и подтвердите с клиентом.
 */
// В Node (тесты, серверная функция) import.meta.env нет: берём пустой объект.
const env = import.meta.env ?? {};

export const SITE = {
  // ── Бренд ──
  name: "Harbor Dental Studio",
  brand: { main: "Harbor Dental", sub: "Studio" }, // две части названия в шапке
  /** Боевой адрес без слэша на конце: canonical, og:url, og:image, JSON-LD */
  url: "https://example.com",
  /** Тип Schema.org: Dentist, MedicalClinic, BeautySalon, AutoRepair, Restaurant, LocalBusiness… */
  schemaType: "Dentist",

  // ── Языки ──
  defaultLocale: "en", // язык, в котором собирается HTML (его видит поисковик)
  ownerLocale: "en", // язык, на котором владелец получает заявки в Telegram
  locales: ["en", "ru"], // доступные в переключателе (нужен файл src/i18n/<код>.js)
  currency: "USD",
  timezone: "America/Chicago", // для бейджа «Open now» и времени заявки

  // ── Контакты ──
  phone: {
    display: "+1 (555) 010-0199",
    e164: "+15550100199",
    /** Страна для маски и проверки номера: US или KZ (см. PHONE_RULES в src/lead.js) */
    country: "US",
  },
  whatsapp: "15550100199", // только цифры, как в wa.me/…
  telegram: "harbordental", // без @
  instagram: "harbordental", // без @

  // ── Адрес ──
  address: {
    street: "1200 Harbor Lane, Suite 4",
    city: "Austin",
    region: "TX",
    postalCode: "78701",
    country: "US",
  },
  /** Если пусто, ссылка ведёт на Google Maps по адресу. Для Казахстана вставьте ссылку на карточку в 2ГИС. */
  mapLinkUrl: "",
  /** URL для <iframe> (Google Maps → Поделиться → Встроить). Пусто = заглушка со ссылкой. */
  mapEmbedUrl: "",

  // ── Часы работы: 0 = воскресенье … 6 = суббота. Дни без записи считаются выходными ──
  hours: [
    { days: [1, 2, 3, 4], open: "08:00", close: "19:00" },
    { days: [5], open: "08:00", close: "16:00" },
    { days: [6], open: "09:00", close: "13:00" },
  ],

  // ── Услуги: id + цена «от». Названия и описания: в словарях (services.items.<id>) ──
  services: [
    { id: "exam", price: 99 },
    { id: "whitening", price: 249 },
    { id: "fillings", price: 149 },
    { id: "crowns", price: 899 },
    { id: "aligners", price: 2490 },
    { id: "emergency", price: 89 },
  ],

  // ── Отзывы ──
  // ТОЛЬКО РЕАЛЬНЫЕ, с разрешения авторов. Пока массив пуст, секция на сайте не показывается.
  // Формат: { name: "Имя", text: { en: "…", ru: "…" }, rating: 5, source: "Google", url: "https://…" }
  reviews: [],

  // ── Аналитика. Скрипты грузятся ТОЛЬКО после согласия посетителя (баннер появится сам) ──
  analytics: {
    yandexMetrika: env.VITE_YANDEX_METRIKA_ID || "", // числовой id счётчика (можно задать и в .env)
    ga4: env.VITE_GA4_ID || "", // G-XXXXXXXXXX
    metaPixel: env.VITE_META_PIXEL_ID || "", // id пикселя
  },

  /** Куда браузер отправляет заявку. Пусто = демо или прямой Telegram (см. README). Обычно "/api/lead". */
  leadEndpoint: "",
};
