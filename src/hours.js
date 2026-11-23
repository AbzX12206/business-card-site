/**
 * Часы работы: строки для отображения и статус «Open now / Closed».
 * Чистые функции без DOM: работают при сборке (Node) и в браузере.
 * Дни: 0 = воскресенье … 6 = суббота.
 */

/** Порядок показа: понедельник первым. */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** «8:00 AM» или «08:00», в зависимости от локали. */
export function formatTime(minutes, locale = "en") {
  const date = new Date(Date.UTC(2000, 0, 1, 0, minutes));
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(date);
}

/** Интервал работы в день недели или null. */
export function intervalFor(hours, day) {
  const row = hours.find((h) => h.days.includes(day));
  return row ? { open: toMinutes(row.open), close: toMinutes(row.close) } : null;
}

/**
 * Строки «Mon–Thu: 8:00 AM – 7:00 PM» с объединением соседних дней с одинаковым графиком.
 * @param dict словарь локали (нужны days.short и hours.closed)
 */
export function buildHoursRows(hours, dict, locale) {
  const names = dict.days.short;
  const cells = DAY_ORDER.map((day) => {
    const iv = intervalFor(hours, day);
    return { day, key: iv ? `${iv.open}-${iv.close}` : "closed", iv };
  });

  const rows = [];
  for (const cell of cells) {
    const last = rows[rows.length - 1];
    if (last && last.key === cell.key) last.days.push(cell.day);
    else rows.push({ key: cell.key, iv: cell.iv, days: [cell.day] });
  }

  return rows.map((row) => ({
    label: row.days.length === 1 ? names[row.days[0]] : `${names[row.days[0]]}–${names[row.days[row.days.length - 1]]}`,
    text: row.iv ? `${formatTime(row.iv.open, locale)} – ${formatTime(row.iv.close, locale)}` : dict.hours.closed,
  }));
}

const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** День недели и минуты от полуночи в заданном часовом поясе. */
export function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  return { day: WEEKDAY[get("weekday")], minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * @returns {{open: true, closesAt: number} | {open: false, next: {offset: number, day: number, at: number} | null}}
 */
export function getOpenStatus(hours, now, timeZone) {
  const { day, minutes } = zonedParts(now, timeZone);
  const today = intervalFor(hours, day);
  if (today && minutes >= today.open && minutes < today.close) return { open: true, closesAt: today.close };

  for (let offset = 0; offset <= 7; offset++) {
    const d = (day + offset) % 7;
    const iv = intervalFor(hours, d);
    if (!iv) continue;
    if (offset === 0 && minutes >= iv.open) continue; // сегодня уже отработали или закрылись
    return { open: false, next: { offset, day: d, at: iv.open } };
  }
  return { open: false, next: null };
}

/** Текст статуса из словаря (dict.status.*). */
export function describeStatus(status, dict, locale) {
  const s = dict.status;
  const fill = (tpl, vars) => tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
  if (status.open) return fill(s.open, { time: formatTime(status.closesAt, locale) });
  if (!status.next) return s.closedAlways;
  const time = formatTime(status.next.at, locale);
  if (status.next.offset === 0) return fill(s.closedToday, { time });
  if (status.next.offset === 1) return fill(s.closedTomorrow, { time });
  return fill(s.closed, { day: dict.days.long[status.next.day], time });
}
