/**
 * Словари и переводчик. Чтобы добавить язык: создайте src/i18n/<код>.js
 * по образцу en.js, импортируйте ниже и добавьте код в SITE.locales.
 */
import { SITE } from "../site.config.js";
import en from "./en.js";
import ru from "./ru.js";

export const dictionaries = { en, ru };

/** Значения, доступные в любой строке словаря как {name}, {city}, {phone}… */
export function globalVars(site = SITE) {
  return {
    name: site.name,
    city: site.address.city,
    region: site.address.region ?? "",
    phone: site.phone.display,
    telegram: site.telegram ?? "",
    instagram: site.instagram ?? "",
  };
}

export function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? String(vars[key]) : match));
}

export function getDict(locale, site = SITE) {
  return dictionaries[locale] ?? dictionaries[site.defaultLocale];
}

function lookup(dict, key) {
  return key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), dict);
}

/** Переводчик: tr("hero.title", {extra}). Нет ключа в языке, берём язык по умолчанию. */
export function createTranslator(locale, site = SITE) {
  const dict = getDict(locale, site);
  const fallback = dictionaries[site.defaultLocale];
  const base = globalVars(site);
  const tr = (key, vars = {}) => {
    let value = lookup(dict, key);
    if (typeof value !== "string") value = lookup(fallback, key);
    if (typeof value !== "string") throw new Error(`Нет строки «${key}» в словарях (${locale} / ${site.defaultLocale})`);
    return interpolate(value, { ...base, ...vars });
  };
  return { tr, dict, locale: dictionaries[locale] ? locale : site.defaultLocale };
}
