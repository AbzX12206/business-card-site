import { renderTemplate } from "./render-template.js";
import { SITE } from "../src/site.config.js";

/** Vite-плагин: рендерит index.html из шаблона на языке по умолчанию. */
export default function htmlTemplate() {
  return {
    name: "html-template",
    transformIndexHtml: { order: "pre", handler: (html) => renderTemplate(html, { locale: SITE.defaultLocale }) },
    handleHotUpdate({ file, server }) {
      if (/site\.config\.js$|[\\/]i18n[\\/]|blocks\.js$|hours\.js$/.test(file)) server.ws.send({ type: "full-reload" });
    },
  };
}
