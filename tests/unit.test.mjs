import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { SITE } from "../src/site.config.js";
import { dictionaries, createTranslator } from "../src/i18n/index.js";
import { buildTelegramText, escapeHtml, formatPhone, getPhoneDigits, isValidPhone, validateLead } from "../src/lead.js";
import { buildHoursRows, describeStatus, getOpenStatus } from "../src/hours.js";
import { activeProviders } from "../src/analytics.js";
import { renderTemplate } from "../build/render-template.js";
import { handleLead } from "../functions/api/lead.js";

const template = readFileSync(new URL("../index.html", import.meta.url), "utf8");

/* ───── телефон ───── */
test("US: маска и нормализация", () => {
  assert.equal(formatPhone("5551234567", "US"), "+1 (555) 123-4567");
  assert.equal(formatPhone("+1 555 123 4567", "US"), "+1 (555) 123-4567");
  assert.equal(formatPhone("15551234567", "US"), "+1 (555) 123-4567");
  assert.equal(formatPhone("555", "US"), "+1 (555");
  assert.equal(formatPhone("", "US"), "");
  assert.equal(getPhoneDigits("+1 (555) 123-4567 99", "US"), "5551234567");
});

test("US: валидность", () => {
  assert.ok(isValidPhone("+1 (555) 123-4567", "US"));
  assert.ok(!isValidPhone("+1 (055) 123-4567", "US")); // код зоны не начинается с 0/1
  assert.ok(!isValidPhone("555123", "US"));
  assert.ok(!isValidPhone("", "US"));
});

test("KZ: маска, 8 и +7 равнозначны", () => {
  assert.equal(formatPhone("87001234567", "KZ"), "+7 (700) 123-45-67");
  assert.equal(formatPhone("+77001234567", "KZ"), "+7 (700) 123-45-67");
  assert.equal(formatPhone("7001234567", "KZ"), "+7 (700) 123-45-67");
  assert.ok(isValidPhone("+7 (700) 123-45-67", "KZ"));
  assert.ok(!isValidPhone("+7 (700) 123-45", "KZ"));
});

test("validateLead: коды ошибок", () => {
  const ok = { name: "Anna", phone: "+1 (555) 123-4567", service: "exam", notes: "" };
  const opts = { country: "US", serviceIds: SITE.services.map((s) => s.id) };
  assert.deepEqual(validateLead(ok, opts), {});
  assert.equal(validateLead({ ...ok, name: "A" }, opts).name, "name");
  assert.equal(validateLead({ ...ok, name: "x".repeat(81) }, opts).name, "name");
  assert.equal(validateLead({ ...ok, phone: "123" }, opts).phone, "phone");
  assert.equal(validateLead({ ...ok, service: "hack" }, opts).service, "service");
  assert.equal(validateLead({ ...ok, notes: "x".repeat(801) }, opts).notes, "notes");
});

test("Telegram-текст экранирует HTML и укладывается в лимит", () => {
  const text = buildTelegramText(
    { name: "<b>Eve</b>", phone: "+1 (555) 123-4567", notes: "a & b <script>", locale: "ru" },
    { siteName: "S&S", serviceTitle: "Crowns", pageUrl: "javascript:alert(1)", timezone: "America/Chicago" },
  );
  assert.ok(!text.includes("<script>") && !text.includes("<b>Eve"));
  assert.ok(text.includes("&lt;b&gt;Eve"));
  assert.ok(!text.includes("javascript:"));
  assert.ok(buildTelegramText({ name: "x", phone: "y", notes: "z".repeat(9000) }, { siteName: "s" }).length <= 4096);
  assert.equal(escapeHtml("<&>"), "&lt;&amp;&gt;");
});

/* ───── часы работы (Austin, зима: UTC-6) ───── */
const status = (iso) => getOpenStatus(SITE.hours, new Date(iso), SITE.timezone);
const text = (iso, locale = "en") => describeStatus(status(iso), dictionaries[locale], locale);

test("статус: граница открытия и закрытия", () => {
  assert.equal(status("2026-11-23T13:59:00Z").open, false); // пн 07:59
  assert.equal(status("2026-11-23T14:00:00Z").open, true); // пн 08:00
  assert.equal(status("2026-11-24T00:59:00Z").open, true); // пн 18:59
  assert.equal(status("2026-11-24T01:00:00Z").open, false); // пн 19:00
});

test("статус: тексты «сегодня / завтра / в понедельник»", () => {
  assert.match(text("2026-11-23T13:00:00Z"), /opens today at 8:00 AM/);
  assert.match(text("2026-11-27T22:00:00Z"), /opens tomorrow at 9:00 AM/); // пт 16:00 → сб
  assert.match(text("2026-11-28T19:00:00Z"), /opens Monday at 8:00 AM/); // сб 13:00 → пн
  assert.match(text("2026-11-23T15:00:00Z"), /Open now · until 7:00 PM/);
  assert.match(text("2026-11-23T15:00:00Z", "ru"), /Открыто · до 19:00/);
});

test("часовой пояс: тот же момент, разные дни", () => {
  const instant = new Date("2026-11-23T03:00:00Z"); // пн 03:00 UTC = вс 21:00 в Остине
  assert.equal(getOpenStatus(SITE.hours, instant, "America/Chicago").open, false);
  assert.equal(getOpenStatus([{ days: [1], open: "01:00", close: "05:00" }], instant, "UTC").open, true);
});

test("строки часов склеивают одинаковые дни", () => {
  const rows = buildHoursRows(SITE.hours, dictionaries.en, "en");
  assert.deepEqual(rows[0], { label: "Mon–Thu", text: "8:00 AM – 7:00 PM" });
  assert.equal(rows.at(-1).label, "Sun");
  assert.equal(rows.at(-1).text, "Closed");
});

/* ───── i18n ───── */
function shape(node, path = "") {
  if (Array.isArray(node)) return [`${path}[${node.length}]`, ...node.flatMap((n, i) => shape(n, `${path}[${i}]`))];
  if (node && typeof node === "object") return Object.keys(node).sort().flatMap((k) => shape(node[k], `${path}.${k}`));
  return [path];
}

test("все словари имеют одинаковую структуру", () => {
  const base = shape(dictionaries.en);
  for (const [code, dict] of Object.entries(dictionaries)) assert.deepEqual(shape(dict), base, `словарь ${code}`);
});

test("SITE.locales ⊆ словари, услуги есть в каждом словаре", () => {
  for (const code of SITE.locales) assert.ok(dictionaries[code], `нет словаря ${code}`);
  for (const code of Object.keys(dictionaries)) for (const s of SITE.services) assert.ok(dictionaries[code].services.items[s.id], `${code}: ${s.id}`);
});

test("переводчик: подстановки и ошибка на неизвестный ключ", () => {
  const { tr } = createTranslator("ru");
  assert.match(tr("meta.title"), /Harbor Dental Studio/);
  assert.match(tr("form.success", { firstName: "Анна" }), /Анна/);
  assert.throws(() => tr("no.such.key"));
});

/* ───── шаблон ───── */
for (const locale of ["en", "ru"]) {
  test(`шаблон (${locale}): нет неподставленных токенов, есть ключевые блоки`, () => {
    const html = renderTemplate(template, { locale });
    assert.ok(!/\{\{|\}\}/.test(html));
    assert.ok(html.includes(`<html lang="${locale}"`));
    assert.equal((html.match(/data-service=/g) || []).length, SITE.services.length);
    assert.equal((html.match(/class="faq-trigger"/g) || []).length, 5);
    assert.ok(html.includes("tel:+15550100199"));
    assert.ok(html.includes("application/ld+json"));
  });
}

test("JSON-LD валиден", () => {
  const html = renderTemplate(template, { locale: "en" });
  const raw = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const data = JSON.parse(raw);
  assert.equal(data["@type"], SITE.schemaType);
  assert.equal(data.openingHoursSpecification.length, SITE.hours.length);
});

test("отзывы: секции нет, пока SITE.reviews пуст", () => {
  assert.ok(!renderTemplate(template, { locale: "en" }).includes('id="reviews"'));
});

test("отзывы: рендерятся и экранируются", () => {
  const site = {
    ...SITE,
    reviews: [{ name: "<img src=x onerror=alert(1)>", rating: 5, text: { en: "Great <b>team</b>", ru: "Отлично" }, source: "Google", url: "javascript:alert(1)" }],
  };
  const html = renderTemplate(template, { locale: "en", site });
  assert.ok(html.includes('id="reviews"'));
  assert.ok(!html.includes("<img src=x") && !html.includes("<b>team</b>"));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(renderTemplate(template, { locale: "ru", site }).includes("Отлично"));
});

test("ссылка на карту: свой URL (2GIS) имеет приоритет, небезопасный игнорируется", () => {
  const two = renderTemplate(template, { locale: "en", site: { ...SITE, mapLinkUrl: "https://2gis.kz/aktau/firm/123" } });
  assert.ok(two.includes('href="https://2gis.kz/aktau/firm/123"'));
  const bad = renderTemplate(template, { locale: "en", site: { ...SITE, mapLinkUrl: "javascript:alert(1)" } });
  assert.ok(bad.includes("google.com/maps"));
});

test("неизвестный токен ломает сборку", () => {
  assert.throws(() => renderTemplate("{{t nope.key}}", { locale: "en" }));
  assert.throws(() => renderTemplate("{{v nope}}", { locale: "en" }));
  assert.throws(() => renderTemplate("{{block nope}}", { locale: "en" }));
});

/* ───── аналитика ───── */
test("аналитика: принимаются только валидные ID", () => {
  assert.deepEqual(activeProviders({}), []);
  assert.deepEqual(activeProviders({ yandexMetrika: "12345678", ga4: "G-ABCD1234", metaPixel: "1234567890" }), ["yandexMetrika", "ga4", "metaPixel"]);
  assert.deepEqual(activeProviders({ yandexMetrika: "1);alert(1", ga4: "G-<x>", metaPixel: "abc" }), []);
});

/* ───── серверная функция ───── */
const ENV = { TELEGRAM_BOT_TOKEN: "TOKEN", TELEGRAM_CHAT_ID: "42" };
const good = { name: "Anna", phone: "+1 (555) 123-4567", service: "exam", notes: "hi", locale: "ru", pageUrl: "https://example.com/" };
const req = (body, { origin = "https://example.com", type = "application/json", method = "POST", ip = "1.1.1.1", raw } = {}) =>
  new Request("https://example.com/api/lead", {
    method,
    headers: { "Content-Type": type, ...(origin ? { Origin: origin } : {}), "CF-Connecting-IP": ip },
    body: method === "POST" ? (raw ?? JSON.stringify(body)) : undefined,
  });
const okFetch = (log = []) => async (url, init) => {
  log.push({ url, body: JSON.parse(init.body) });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
const body = async (res) => res.json();

test("API: успех, токен остаётся на сервере, услуга на языке владельца", async () => {
  const log = [];
  const res = await handleLead(req(good), ENV, { fetchImpl: okFetch(log), now: 1 });
  assert.equal(res.status, 200);
  const answer = await body(res);
  assert.deepEqual(answer, { ok: true });
  assert.ok(!JSON.stringify(answer).includes("TOKEN"));
  assert.ok(log[0].url.includes("/botTOKEN/sendMessage"));
  assert.equal(log[0].body.chat_id, "42");
  assert.ok(log[0].body.text.includes("Exam & Cleaning".replace("&", "&amp;")));
});

test("API: отказы (метод, origin, тип, JSON, размер, валидация)", async () => {
  const f = { fetchImpl: okFetch(), now: 2 };
  assert.equal((await handleLead(req(null, { method: "GET" }), ENV, f)).status, 405);
  assert.equal((await handleLead(req(good, { origin: "https://evil.example" }), ENV, f)).status, 403);
  assert.equal((await handleLead(req(good, { origin: "" }), ENV, f)).status, 403);
  assert.equal((await handleLead(req(good, { type: "text/plain" }), ENV, f)).status, 415);
  assert.equal((await handleLead(req(null, { raw: "{oops" }), ENV, f)).status, 400);
  assert.equal((await handleLead(req(null, { raw: JSON.stringify({ ...good, notes: "x".repeat(9000) }) }), ENV, f)).status, 413);
  const bad = await handleLead(req({ ...good, phone: "1" }), ENV, f);
  assert.equal(bad.status, 400);
  assert.equal((await body(bad)).errors.phone, "phone");
});

test("API: honeypot отвечает ok без отправки", async () => {
  const log = [];
  const res = await handleLead(req({ ...good, website: "http://spam" }), ENV, { fetchImpl: okFetch(log), now: 3 });
  assert.equal(res.status, 200);
  assert.equal(log.length, 0);
});

test("API: лимит запросов с одного IP", async () => {
  const f = { fetchImpl: okFetch(), now: 4 };
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await handleLead(req(good, { ip: "9.9.9.9" }), ENV, f)).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 429, 429]);
  assert.equal((await handleLead(req(good, { ip: "8.8.8.8" }), ENV, f)).status, 200);
});

test("API: ошибки Telegram и отсутствие секретов", async () => {
  const fail = async () => new Response("{}", { status: 400 });
  assert.equal((await handleLead(req(good, { ip: "7.7.7.1" }), ENV, { fetchImpl: fail, now: 5 })).status, 502);
  const boom = async () => { throw new Error("net"); };
  assert.equal((await handleLead(req(good, { ip: "7.7.7.2" }), ENV, { fetchImpl: boom, now: 5 })).status, 502);
  assert.equal((await handleLead(req(good, { ip: "7.7.7.3" }), {}, { fetchImpl: okFetch(), now: 5 })).status, 500);
});

test("API: привязка RATE_LIMITER имеет приоритет", async () => {
  const env = { ...ENV, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await handleLead(req(good, { ip: "6.6.6.6" }), env, { fetchImpl: okFetch(), now: 6 })).status, 429);
});
