/**
 * Общая логика заявки. Используется и в браузере (src/main.js), и на сервере
 * (functions/api/lead.js), поэтому здесь нет DOM и import.meta.env.
 */

/* ═════════════ Телефон: правила по странам ═════════════
   mask: «#» = цифра. Литералы выводятся, только пока есть, что за ними показывать.
   Чтобы добавить страну, добавьте запись и укажите её код в SITE.phone.country. */
export const PHONE_RULES = {
  US: {
    mask: "+1 (###) ###-####",
    cc: "1",
    length: 10,
    valid: /^[2-9]\d{9}$/, // код зоны не начинается с 0 или 1
    stripLeading: "1", // «1» в начале национального номера = код страны (в США коды зон на 1 не начинаются)
    placeholder: "+1 (555) 000-0000",
  },
  KZ: {
    mask: "+7 (###) ###-##-##",
    cc: "7",
    length: 10,
    valid: /^7\d{9}$/, // номера Казахстана: +7 7XX XXX XX XX
    trunk: "8", // внутренний префикс: 8 700 123 45 67
    placeholder: "+7 (700) 000-00-00",
  },
};

export function getPhoneRule(country = "US") {
  return PHONE_RULES[country] ?? PHONE_RULES.US;
}

/** Национальные цифры номера без кода страны. */
export function getPhoneDigits(value, country = "US") {
  const rule = getPhoneRule(country);
  const raw = String(value ?? "").trim();
  let digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) {
    // Явный код страны: +1…, +7…
    if (digits.startsWith(rule.cc)) digits = digits.slice(rule.cc.length);
  } else if (rule.stripLeading && digits.startsWith(rule.stripLeading)) {
    digits = digits.slice(rule.stripLeading.length);
  } else if (rule.trunk && digits.length === rule.length + 1 && (digits.startsWith(rule.trunk) || digits.startsWith(rule.cc))) {
    digits = digits.slice(1); // 8 700… или 7 700… (11 цифр)
  }
  return digits.slice(0, rule.length);
}

function applyMask(mask, digits) {
  if (!digits) return "";
  let out = "";
  let i = 0;
  for (const ch of mask) {
    if (ch === "#") {
      if (i >= digits.length) break;
      out += digits[i++];
    } else if (i < digits.length) {
      out += ch; // литерал выводим, только если дальше есть цифры
    }
  }
  return out;
}

/** Маска, подстраивающаяся по мере ввода. */
export function formatPhone(value, country = "US") {
  return applyMask(getPhoneRule(country).mask, getPhoneDigits(value, country));
}

export function isValidPhone(value, country = "US") {
  return getPhoneRule(country).valid.test(getPhoneDigits(value, country));
}

/* ═════════════ Валидация заявки ═════════════ */

export const LIMITS = { name: 80, notes: 800, bodyBytes: 8 * 1024 };

/**
 * @param {{name?: string, phone?: string, service?: string, notes?: string}} lead
 * @param {{country?: string, serviceIds?: string[]}} options
 * @returns {{name?: "name", phone?: "phone", service?: "service", notes?: "notes"}} коды ошибок; пустой объект = всё верно
 */
export function validateLead(lead, { country = "US", serviceIds } = {}) {
  const errors = {};
  const name = String(lead.name ?? "").trim();
  if (name.length < 2 || name.length > LIMITS.name) errors.name = "name";
  if (!isValidPhone(lead.phone ?? "", country)) errors.phone = "phone";
  if (lead.service && serviceIds && !serviceIds.includes(lead.service)) errors.service = "service";
  if (String(lead.notes ?? "").length > LIMITS.notes) errors.notes = "notes";
  return errors;
}

/* ═════════════ Сообщение в Telegram ═════════════ */

/** Экранирование под parse_mode=HTML. Управляющие символы удаляются. */
export function escapeHtml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * @param {object} lead
 * @param {{siteName: string, serviceTitle?: string, pageUrl?: string, timezone?: string, now?: Date}} ctx
 */
export function buildTelegramText(lead, { siteName, serviceTitle = "", pageUrl = "", timezone = "UTC", now = new Date() }) {
  const lines = [`🔔 <b>New website lead</b> · ${escapeHtml(siteName)}`, ""];
  lines.push(`👤 <b>Name:</b> ${escapeHtml(String(lead.name).trim())}`);
  lines.push(`📞 <b>Phone:</b> ${escapeHtml(String(lead.phone).trim())}`);
  if (serviceTitle) lines.push(`🛠 <b>Service:</b> ${escapeHtml(serviceTitle)}`);
  if (lead.notes && String(lead.notes).trim()) lines.push(`💬 <b>Notes:</b>\n${escapeHtml(String(lead.notes).trim())}`);
  if (lead.locale) lines.push(`🌐 <b>Site language:</b> ${escapeHtml(lead.locale)}`);

  const page = safeHttpUrl(pageUrl);
  if (page) lines.push("", `🔗 ${escapeHtml(page)}`);

  let time;
  try {
    time = new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: timezone }).format(now);
  } catch {
    time = now.toISOString();
  }
  lines.push(`🕒 ${escapeHtml(time)}`);
  return lines.join("\n").slice(0, 4096);
}
