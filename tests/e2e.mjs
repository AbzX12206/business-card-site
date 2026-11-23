/**
 * e2e в реальном Chromium (Playwright). Запускается через `npm run test:e2e`
 * (tests/run-e2e.mjs собирает сайт и поднимает preview) либо напрямую:
 *   BASE_URL=http://localhost:4173 E2E_MODE=main node tests/e2e.mjs
 * E2E_MODE=main: сборка с VITE_LEAD_ENDPOINT=/api/lead, без аналитики.
 * E2E_MODE=analytics: сборка с VITE_GA4_ID=G-TEST1234.
 * E2E_NO_CSS=1 пропускает проверки видимости, которым нужен Tailwind (для окружений без сборки CSS).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const MODE = process.env.E2E_MODE || "main";
const NO_CSS = process.env.E2E_NO_CSS === "1";

let passed = 0;
const failures = [];
const skipped = [];

async function check(name, fn, { needsCss = false } = {}) {
  if (needsCss && NO_CSS) return skipped.push(name);
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${String(error.message).split("\n")[0]}`);
  }
}
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || "assertion failed");
};
const eq = (a, b, msg) => assert(a === b, `${msg || "eq"}: ожидали ${JSON.stringify(b)}, получили ${JSON.stringify(a)}`);

const browser = await chromium.launch();

async function fresh({ time, locale = "en-US", offline = false } = {}) {
  const context = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  if (time) await page.clock.install({ time: new Date(time) });
  await page.goto(BASE, { waitUntil: "load" });
  return { context, page, errors };
}

async function fillValid(page, extra = {}) {
  await page.fill("#lead-name", extra.name ?? "Anna Petrova");
  await page.fill("#lead-phone", extra.phone ?? "5551234567");
  if (extra.service) await page.selectOption("#lead-service", extra.service);
  if (extra.notes) await page.fill("#lead-notes", extra.notes);
}

if (MODE === "main") {
  console.log("e2e: основной режим");

  await check("страница грузится без JS-ошибок, заголовок и H1 на английском", async () => {
    const { context, page, errors } = await fresh();
    assert((await page.title()).includes("Harbor Dental Studio"));
    assert((await page.textContent("h1")).includes("price is agreed"));
    eq(await page.getAttribute("html", "lang"), "en");
    eq(errors.length, 0, errors.join("; "));
    await context.close();
  });

  await check("карточки услуг и опции формы совпадают по числу", async () => {
    const { context, page } = await fresh();
    eq(await page.locator("[data-service]").count(), 6);
    eq(await page.locator("#lead-service option").count(), 7);
    await context.close();
  });

  await check("«Select Service» подставляет услугу в форму", async () => {
    const { context, page } = await fresh();
    await page.click('[data-service="crowns"]');
    eq(await page.inputValue("#lead-service"), "crowns");
    await context.close();
  });

  await check("FAQ: открытие/закрытие и стрелки клавиатуры", async () => {
    const { context, page } = await fresh();
    await page.click("#faq-q1");
    eq(await page.getAttribute("#faq-q1", "aria-expanded"), "true");
    await page.click("#faq-q1");
    eq(await page.getAttribute("#faq-q1", "aria-expanded"), "false");
    await page.focus("#faq-q1");
    await page.keyboard.press("ArrowDown");
    eq(await page.evaluate(() => document.activeElement.id), "faq-q2");
    await context.close();
  });

  await check("маска телефона US", async () => {
    const { context, page } = await fresh();
    await page.fill("#lead-phone", "");
    await page.type("#lead-phone", "5551234567");
    eq(await page.inputValue("#lead-phone"), "+1 (555) 123-4567");
    await context.close();
  });

  await check("валидация: ошибки, aria-invalid, фокус на первом поле, без запроса", async () => {
    const { context, page } = await fresh();
    let requests = 0;
    await page.route("**/api/lead", (r) => (requests++, r.abort()));
    await page.click("#lead-submit");
    eq(await page.getAttribute("#lead-name", "aria-invalid"), "true");
    eq(await page.getAttribute("#lead-phone", "aria-invalid"), "true");
    eq(await page.evaluate(() => document.activeElement.id), "lead-name");
    assert((await page.textContent("#lead-name-error")).length > 5);
    eq(requests, 0);
    await page.fill("#lead-name", "Anna");
    eq(await page.getAttribute("#lead-name", "aria-invalid"), "false");
    await context.close();
  });

  await check("успех: POST /api/lead с id услуги, языком и без токенов; форма очищается", async () => {
    const { context, page } = await fresh();
    let posted;
    await page.route("**/api/lead", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await fillValid(page, { service: "whitening", notes: "evenings" });
    await page.click("#lead-submit");
    await page.waitForSelector('#form-status[data-state="success"]');
    assert((await page.textContent("#form-status")).includes("Anna"));
    eq(posted.service, "whitening");
    eq(posted.locale, "en");
    eq(posted.phone, "+1 (555) 123-4567");
    assert(!JSON.stringify(posted).toLowerCase().includes("token"));
    eq(await page.inputValue("#lead-name"), "");
    await context.close();
  });

  await check("429 → сообщение про лимит; 500 → ошибка со ссылками tel/WhatsApp", async () => {
    const { context, page } = await fresh();
    let status = 429;
    await page.route("**/api/lead", (route) => route.fulfill({ status, contentType: "application/json", body: '{"ok":false}' }));
    await fillValid(page);
    await page.click("#lead-submit");
    await page.waitForSelector('#form-status[data-state="error"]');
    assert((await page.textContent("#form-status")).includes("Too many"));
    status = 500;
    await page.click("#lead-submit");
    await page.waitForFunction(() => document.querySelector("#form-status")?.textContent.includes("couldn't send"));
    assert(await page.locator('#form-status a[href^="tel:"]').count() === 1);
    assert(await page.locator('#form-status a[href^="https://wa.me/"]').count() === 1);
    eq(await page.inputValue("#lead-name"), "Anna Petrova"); // данные не потеряны
    await context.close();
  });

  await check("офлайн → сообщение про соединение", async () => {
    const { context, page } = await fresh();
    await fillValid(page);
    await context.setOffline(true);
    await page.click("#lead-submit");
    await page.waitForSelector('#form-status[data-state="error"]');
    assert((await page.textContent("#form-status")).includes("offline"));
    await context.close();
  });

  await check("honeypot: запрос не уходит, пользователь видит «успех»", async () => {
    const { context, page } = await fresh();
    let requests = 0;
    await page.route("**/api/lead", (r) => (requests++, r.abort()));
    await fillValid(page);
    await page.evaluate(() => (document.querySelector('input[name="website"]').value = "http://spam"));
    await page.click("#lead-submit");
    await page.waitForSelector('#form-status[data-state="success"]');
    eq(requests, 0);
    await context.close();
  });

  await check("двойной клик по отправке даёт один запрос", async () => {
    const { context, page } = await fresh();
    let requests = 0;
    await page.route("**/api/lead", async (route) => {
      requests++;
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await fillValid(page);
    await page.dblclick("#lead-submit");
    await page.waitForSelector('#form-status[data-state="success"]');
    eq(requests, 1);
    await context.close();
  });

  await check("политика конфиденциальности: открывается и закрывается (Esc)", async () => {
    const { context, page } = await fresh();
    await page.click("footer [data-open-privacy]");
    assert(await page.evaluate(() => document.getElementById("privacy-dialog").open));
    await page.keyboard.press("Escape");
    assert(!(await page.evaluate(() => document.getElementById("privacy-dialog").open)));
    await context.close();
  });

  await check("переключатель языка: RU меняет тексты, lang, title, часы, цены и сохраняется после перезагрузки", async () => {
    const { context, page } = await fresh();
    await page.selectOption("#lead-service", "crowns");
    await page.click('.lang-btn[data-lang="ru"] >> nth=0');
    eq(await page.getAttribute("html", "lang"), "ru");
    assert((await page.textContent("h1")).includes("Стоматология"));
    assert((await page.title()).includes("Семейная"));
    assert((await page.textContent('[data-block="hours"]')).includes("Пн–Чт"));
    assert((await page.textContent("#services")).includes("899"));
    eq(await page.inputValue("#lead-service"), "crowns"); // выбор не сбросился
    eq(await page.locator('.lang-btn[data-lang="ru"][aria-pressed="true"]').count() > 0, true);
    await page.click("#faq-q1");
    eq(await page.getAttribute("#faq-q1", "aria-expanded"), "true"); // FAQ работает после перерисовки
    await page.reload();
    eq(await page.getAttribute("html", "lang"), "ru");
    await context.close();
  });

  await check("язык браузера ru выбирается автоматически", async () => {
    const { context, page } = await fresh({ locale: "ru-RU" });
    eq(await page.getAttribute("html", "lang"), "ru");
    await context.close();
  });

  await check("отправка на русском: locale=ru в запросе, сообщение на русском", async () => {
    const { context, page } = await fresh({ locale: "ru-RU" });
    let posted;
    await page.route("**/api/lead", async (route) => {
      posted = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await fillValid(page);
    await page.click("#lead-submit");
    await page.waitForSelector('#form-status[data-state="success"]');
    eq(posted.locale, "ru");
    assert((await page.textContent("#form-status")).includes("Спасибо"));
    await context.close();
  });

  await check("бейдж: понедельник 10:00 в Остине → открыто до 7:00 PM", async () => {
    const { context, page } = await fresh({ time: "2026-11-23T16:00:00Z" });
    const text = await page.textContent("[data-open-status] >> nth=0");
    assert(/Open now · until 7:00 PM/.test(text), text);
    eq(await page.getAttribute("[data-open-status] >> nth=0", "data-state"), "open");
    await context.close();
  });

  await check("бейдж: суббота 13:00 → закрыто, откроемся в понедельник", async () => {
    const { context, page } = await fresh({ time: "2026-11-28T19:00:00Z" });
    const text = await page.textContent("[data-open-status] >> nth=0");
    assert(/Closed · opens Monday at 8:00 AM/.test(text), text);
    await context.close();
  });

  await check("аналитика не настроена: баннера нет, сторонних запросов нет", async () => {
    const { context, page } = await fresh();
    const external = [];
    page.on("request", (r) => /googletagmanager|mc\.yandex|facebook/.test(r.url()) && external.push(r.url()));
    await page.reload();
    eq(await page.locator("#consent").isVisible(), false);
    eq(external.length, 0);
    await context.close();
  });

  await check("мобильный экран: нет горизонтального скролла, нижняя панель видна", async () => {
    const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await context.newPage();
    await page.goto(BASE);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 0, `переполнение ${overflow}px`);
    assert(await page.locator(".action-bar").isVisible());
    await context.close();
  }, { needsCss: true });

  await check("мобильное меню открывается и закрывается, aria-label меняется", async () => {
    const context = await browser.newContext({ viewport: { width: 375, height: 700 } });
    const page = await context.newPage();
    await page.goto(BASE);
    await page.click("#menu-toggle");
    eq(await page.getAttribute("#menu-toggle", "aria-expanded"), "true");
    eq(await page.getAttribute("#menu-toggle", "aria-label"), "Close menu");
    await page.keyboard.press("Escape");
    eq(await page.getAttribute("#menu-toggle", "aria-expanded"), "false");
    await context.close();
  });
}

if (MODE === "analytics") {
  console.log("e2e: режим аналитики (VITE_GA4_ID=G-TEST1234)");
  const gtm = (page, hits) =>
    page.route(/googletagmanager\.com/, (route) => (hits.push(route.request().url()), route.fulfill({ status: 200, contentType: "text/javascript", body: "" })));

  await check("без решения: баннер виден, скрипты не грузятся", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const hits = [];
    await gtm(page, hits);
    await page.goto(BASE);
    assert(await page.locator("#consent").isVisible());
    await page.waitForTimeout(300);
    eq(hits.length, 0);
    await context.close();
  }, { needsCss: true });

  await check("отказ: скрипты не грузятся, баннер скрыт и не возвращается после перезагрузки", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const hits = [];
    await gtm(page, hits);
    await page.goto(BASE);
    await page.click('[data-consent="denied"]');
    eq(await page.locator("#consent").isHidden(), true);
    await page.reload();
    eq(await page.locator("#consent").isHidden(), true);
    await page.waitForTimeout(300);
    eq(hits.length, 0);
    await context.close();
  });

  await check("согласие: грузится gtag, цели уходят в dataLayer, решение сохраняется", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const hits = [];
    await gtm(page, hits);
    await page.goto(BASE);
    await page.click('[data-consent="granted"]');
    await page.waitForFunction(() => Array.isArray(window.dataLayer));
    assert(hits.some((u) => u.includes("id=G-TEST1234")));
    await page.click('footer a[href^="tel:"]', { modifiers: [] }).catch(() => {});
    const events = await page.evaluate(() => window.dataLayer.map((a) => Array.from(a).join(":")));
    assert(events.some((e) => e.startsWith("config:G-TEST1234")), events.join(" | "));
    await page.reload();
    await page.waitForFunction(() => Array.isArray(window.dataLayer)); // загрузился сам, баннера нет
    eq(await page.locator("#consent").isHidden(), true);
    await context.close();
  });

  await check("«Настройки cookie» в подвале возвращает баннер", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(BASE);
    await page.click('[data-consent="denied"]');
    await page.click("[data-open-consent]");
    eq(await page.locator("#consent").isHidden(), false);
    await context.close();
  });
}

await browser.close();
console.log(`\n${passed} прошли, ${failures.length} упали, ${skipped.length} пропущено${skipped.length ? " (нужен CSS: " + skipped.join("; ") + ")" : ""}`);
process.exit(failures.length ? 1 : 0);
