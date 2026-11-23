/**
 * Cloudflare Pages Function: POST /api/lead
 * Принимает заявку с сайта и пересылает её в Telegram. Токен бота живёт только в
 * секретах проекта (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID), в браузер не попадает.
 *
 * Необязательные настройки окружения:
 *   ALLOWED_ORIGINS  список через запятую, с каких адресов принимать запросы (помимо адреса сайта)
 *   RATE_LIMITER     привязка Workers Rate Limiting (надёжный лимит)
 *   RATE_KV          привязка KV-хранилища (лимит средней надёжности)
 *   Без обеих привязок лимит считается в памяти одного воркера: это только грубая защита.
 */
import { SITE } from "../../src/site.config.js";
import { createContext } from "../../src/blocks.js";
import { LIMITS, buildTelegramText, validateLead } from "../../src/lead.js";

const MAX_PER_WINDOW = 5;
const WINDOW_SECONDS = 600;
const memoryHits = new Map();

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });

function originAllowed(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  const allowed = new Set([new URL(request.url).origin, new URL(SITE.url).origin]);
  String(env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => allowed.add(s));
  return allowed.has(origin);
}

async function rateLimited(request, env, now) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.RATE_LIMITER?.limit) {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return !success;
  }
  if (env.RATE_KV) {
    const key = `lead:${ip}`;
    const count = Number((await env.RATE_KV.get(key)) ?? 0);
    if (count >= MAX_PER_WINDOW) return true;
    await env.RATE_KV.put(key, String(count + 1), { expirationTtl: WINDOW_SECONDS });
    return false;
  }
  const fresh = (memoryHits.get(ip) ?? []).filter((t) => now - t < WINDOW_SECONDS * 1000);
  if (fresh.length >= MAX_PER_WINDOW) {
    memoryHits.set(ip, fresh);
    return true;
  }
  fresh.push(now);
  memoryHits.set(ip, fresh);
  if (memoryHits.size > 5000) memoryHits.clear(); // не даём карте расти бесконечно
  return false;
}

/** Вынесено отдельно для тестов: принимает Request, возвращает Response. */
export async function handleLead(request, env = {}, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (request.method !== "POST") return json({ ok: false, error: "method" }, 405, { Allow: "POST" });
  if (!originAllowed(request, env)) return json({ ok: false, error: "origin" }, 403);
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    return json({ ok: false, error: "content-type" }, 415);
  }

  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > LIMITS.bodyBytes) return json({ ok: false, error: "too-large" }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) return json({ ok: false, error: "too-large" }, 413);

  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "json" }, 400);

  // Honeypot: бот заполнил скрытое поле. Отвечаем «успехом», ничего не отправляя.
  if (typeof body.website === "string" && body.website.trim() !== "") return json({ ok: true });

  if (await rateLimited(request, env, now)) return json({ ok: false, error: "rate" }, 429, { "Retry-After": String(WINDOW_SECONDS) });

  const lead = {
    name: typeof body.name === "string" ? body.name : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    service: typeof body.service === "string" ? body.service : "",
    notes: typeof body.notes === "string" ? body.notes : "",
    locale: SITE.locales.includes(body.locale) ? body.locale : "",
  };
  const errors = validateLead(lead, { country: SITE.phone.country, serviceIds: SITE.services.map((s) => s.id) });
  if (Object.keys(errors).length) return json({ ok: false, error: "validation", errors }, 400);

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.error("[lead] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set");
    return json({ ok: false, error: "not-configured" }, 500);
  }

  const owner = createContext(SITE.ownerLocale);
  const text = buildTelegramText(lead, {
    siteName: SITE.name,
    serviceTitle: lead.service ? owner.dict.services.items[lead.service]?.title ?? "" : "",
    pageUrl: typeof body.pageUrl === "string" ? body.pageUrl : "",
    timezone: SITE.timezone,
    now: new Date(now),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.ok !== true) {
      console.error(`[lead] Telegram responded with status ${response.status}`); // URL с токеном не логируем
      return json({ ok: false, error: "upstream" }, 502);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("[lead] Telegram request failed:", error instanceof Error ? error.name : "unknown");
    return json({ ok: false, error: "upstream" }, 502);
  } finally {
    clearTimeout(timer);
  }
}

export const onRequest = ({ request, env }) => handleLead(request, env);
