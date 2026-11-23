/**
 * Подстановка токенов в index.html (чистая функция, работает в Node и в тестах).
 *   {{t ключ}}      перевод из словаря (экранируется)
 *   {{v имя}}       значение из siteValues() (экранируется)
 *   {{block имя}}   HTML-блок из src/blocks.js
 *   {{jsonld}}      JSON-LD для поисковиков
 * Неизвестный токен или ключ = ошибка сборки, а не молчаливая дыра на странице.
 */
import { createContext, renderBlock, siteValues, jsonLd } from "../src/blocks.js";
import { escapeHtml } from "../src/lead.js";

const safe = (s) => escapeHtml(s).replace(/"/g, "&quot;");
const TOKEN = /\{\{\s*(t|v|block|jsonld)(?:\s+([\w.-]+))?\s*\}\}/g;

export function renderTemplate(html, { locale, site } = {}) {
  const ctx = createContext(locale, site);
  const values = siteValues(ctx.site);
  const out = html.replace(TOKEN, (_, kind, arg) => {
    if (kind === "jsonld") return jsonLd(ctx);
    if (!arg) throw new Error(`Токен {{${kind}}} без аргумента`);
    if (kind === "t") return safe(ctx.tr(arg));
    if (kind === "block") return renderBlock(arg, ctx);
    if (!(arg in values)) throw new Error(`Неизвестное значение {{v ${arg}}}`);
    return safe(values[arg]);
  });
  const left = out.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`Нераспознанный токен в шаблоне: ${left[0]}`);
  return out.replace(/<html lang="[^"]*"/, `<html lang="${ctx.locale}"`);
}
