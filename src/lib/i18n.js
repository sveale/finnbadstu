const NORWEGIAN_TAGS = new Set(["nb-no", "nb-nn", "nn-no", "nb", "nn"]);

export const TRANSLATIONS = {
  en: {
    "title.home": "finnbadstu",
    "title.about": "About | finnbadstu",
    "index.hiddenHeading": "finnbadstu - find saunas in Norway",
    "index.mapAriaLabel": "Map of saunas in Norway",
    "nav.menu": "Menu",
    "nav.about": "About",
    "about.heading": "About finnbadstu",
    "about.p1":
      "finnbadstu helps you find sauna locations in Norway using map data and nearby search.",
    "about.p2":
      "The goal is a fast and simple experience for keywords like sauna, badstu, and badstu norge.",
    "about.back": "Back to map",
    "contact.p1":
      "For suggestions, missing sauna locations, or general feedback, please contact us by email:",
    "app.label.addressUnavailable": "Address unavailable",
    "app.label.website": "Website",
    "app.label.openMaps": "Open in Google Maps",
    "app.label.unknownSauna": "Unknown sauna",
    "app.searchArea.button": "Search this area",
    "app.searchArea.searching": "Searching...",
    "app.location.button": "Go to my location",
    "app.location.locating": "Locating..."
  },
  nb: {
    "title.home": "finnbadstu",
    "title.about": "Om | finnbadstu",
    "index.hiddenHeading": "finnbadstu - finn badstuer i Norge",
    "index.mapAriaLabel": "Kart over badstuer i Norge",
    "nav.menu": "Meny",
    "nav.about": "Om",
    "about.heading": "Om finnbadstu",
    "about.p1":
      "finnbadstu hjelper deg med å finne badstuer i Norge ved å bruke kartdata fra Google Maps i kombinasjon med en manuell definisjon av badstuer.",
    "about.p2":
      "Målet er en rask og enkel tjeneste for søk etter badstuer i Norge",
    "about.back": "Tilbake til kartet",
    "contact.p1":
      "For forslag, manglende badstuer eller generelle tilbakemeldinger, ta kontakt på e-post:",
    "app.label.addressUnavailable": "Adresse ikke tilgjengelig",
    "app.label.website": "Nettside",
    "app.label.openMaps": "Åpne i Google Maps",
    "app.label.unknownSauna": "Ukjent badstu",
    "app.searchArea.button": "Søk i dette området",
    "app.searchArea.searching": "Søker...",
    "app.location.button": "Gå til min posisjon",
    "app.location.locating": "Finner posisjon..."
  }
};

export function detectLocale() {
  if (typeof navigator === "undefined") {
    return "en";
  }

  const languages =
    Array.isArray(navigator.languages) && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const language of languages) {
    const normalized = normalizeLanguageTag(language);
    if (NORWEGIAN_TAGS.has(normalized)) {
      return "nb";
    }
  }

  return "en";
}

export function t(locale, key, variables = {}) {
  const dictionary = TRANSLATIONS[locale] || TRANSLATIONS.en;
  const fallback = TRANSLATIONS.en[key] || key;
  const template = dictionary[key] || fallback;

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, variableName) =>
    variableName in variables ? String(variables[variableName]) : ""
  );
}

export function htmlLang(locale) {
  return locale === "nb" ? "nb" : "en";
}

function normalizeLanguageTag(tag) {
  return String(tag || "").trim().toLowerCase().replaceAll("_", "-");
}
