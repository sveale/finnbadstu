import { detectLocale, htmlLang, t } from "../lib/i18n.js";

const locale = detectLocale();
window.__FINNBADSTU_LOCALE__ = locale;

if (document.documentElement) {
  document.documentElement.lang = htmlLang(locale);
}

const titleKey = document.body?.dataset?.titleKey;
if (titleKey) {
  document.title = t(locale, titleKey);
}

for (const element of document.querySelectorAll("[data-i18n]")) {
  const key = element.getAttribute("data-i18n");
  if (!key) continue;
  element.textContent = t(locale, key);
}

for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
  const key = element.getAttribute("data-i18n-aria-label");
  if (!key) continue;
  element.setAttribute("aria-label", t(locale, key));
}

for (const element of document.querySelectorAll("[data-i18n-title]")) {
  const key = element.getAttribute("data-i18n-title");
  if (!key) continue;
  element.setAttribute("title", t(locale, key));
}
