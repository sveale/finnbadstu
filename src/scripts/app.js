import { detectLocale, t } from "../lib/i18n.js";

const SOUTHERN_NORWAY_CENTER = { lat: 59.9139, lng: 10.7522 };
const NEARBY_RADIUS_METERS = 75000;
const MAX_VISIBLE_SAUNAS = 80;
const LIVE_RESULT_LIMIT = 20;
const LIVE_SEARCH_RADIUS_METERS = 50000;
const VIEWPORT_KM_WITH_LOCATION = 10;
const VIEWPORT_KM_NO_LOCATION = 100;
const LIVE_TEXT_QUERIES = ["sauna", "badstu"];
const MANUAL_SAUNA_DATA_PATH = `${import.meta.env.BASE_URL}data/saunas.manual.json`;
const MANUAL_LIVE_MERGE_DISTANCE_METERS = 100;

const state = {
  map: null,
  infoWindow: null,
  markerById: new Map(),
  markerSaunaById: new Map(),
  activeCenter: SOUTHERN_NORWAY_CENTER,
  viewportCenter: SOUTHERN_NORWAY_CENTER,
  viewportKm: VIEWPORT_KM_NO_LOCATION,
  userLocation: null,
  manualSaunas: [],
  liveSaunas: [],
  locale: detectLocale(),
  readyForAreaSearch: false,
  isApplyingViewport: false,
  lastSearchCenter: null,
  lastSearchZoom: null
};

let placeClassPromise = null;

document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-app-root]");
  if (!root) return;
  void bootstrap(root);
});

async function bootstrap(root) {
  const elements = getElements();
  if (!elements) return;

  const mapsApiKey = (root.getAttribute("data-google-maps-key") || "").trim();

  if (!mapsApiKey) {
    console.error("Missing PUBLIC_GOOGLE_MAPS_API_KEY. Map cannot be initialized.");
    return;
  }

  try {
    await loadGoogleMapsApi(mapsApiKey);

    state.map = new google.maps.Map(elements.map, {
      center: SOUTHERN_NORWAY_CENTER,
      zoom: 9,
      clickableIcons: false,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "cooperative"
    });
    state.infoWindow = new google.maps.InfoWindow();
    attachMapControls(elements);
    wireSearchAreaInteractions(elements);
    setSearchAreaButtonVisible(elements, false);
    state.manualSaunas = await loadManualSaunas();

    state.activeCenter = SOUTHERN_NORWAY_CENTER;
    state.viewportCenter = SOUTHERN_NORWAY_CENTER;
    state.viewportKm = VIEWPORT_KM_NO_LOCATION;
    applyViewport();
    refreshUi();

    const userLocation = await getUserLocation();
    if (userLocation) {
      state.userLocation = userLocation;
      state.activeCenter = userLocation;
      state.viewportCenter = userLocation;
      state.viewportKm = VIEWPORT_KM_WITH_LOCATION;
      applyViewport();
    } else {
      state.userLocation = null;
      state.activeCenter = SOUTHERN_NORWAY_CENTER;
      state.viewportCenter = SOUTHERN_NORWAY_CENTER;
      state.viewportKm = VIEWPORT_KM_NO_LOCATION;
      applyViewport();
    }

    const initialRadiusMeters = getSearchRadiusMetersFromMap(state.activeCenter);
    state.liveSaunas = await fetchLiveSaunas(state.activeCenter, {
      radiusMeters: initialRadiusMeters
    });
    refreshUi();
    captureSearchViewport(elements);
    state.readyForAreaSearch = true;
  } catch (error) {
    console.error(error);
  }
}

function getElements() {
  const map = document.getElementById("map");
  const searchAreaButton = document.getElementById("search-area-button");
  const myLocationButton = document.getElementById("my-location-button");

  if (!map || !searchAreaButton || !myLocationButton) {
    return null;
  }

  return { map, searchAreaButton, myLocationButton };
}

function attachMapControls(elements) {
  if (!state.map || !elements?.myLocationButton) return;
  state.map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(elements.myLocationButton);
}

function refreshUi() {
  const allSaunas = mergeManualAndLiveSaunas(state.manualSaunas, state.liveSaunas);
  const nearbySaunas = getNearbySaunas(allSaunas, state.activeCenter);
  renderMarkers(nearbySaunas);
}

function mergeManualAndLiveSaunas(manualSaunas, liveSaunas) {
  const normalizedManual = dedupeSaunas(manualSaunas);
  const normalizedLive = dedupeSaunas(liveSaunas);

  if (normalizedManual.length === 0) {
    return normalizedLive;
  }

  if (normalizedLive.length === 0) {
    return normalizedManual;
  }

  const matchedLiveIndexes = new Set();
  const merged = [];

  for (const manualSauna of normalizedManual) {
    const duplicates = [manualSauna];

    for (let index = 0; index < normalizedLive.length; index += 1) {
      if (matchedLiveIndexes.has(index)) continue;

      const liveSauna = normalizedLive[index];
      const distanceMeters = haversineDistanceMeters(manualSauna.location, liveSauna.location);

      if (distanceMeters <= MANUAL_LIVE_MERGE_DISTANCE_METERS) {
        matchedLiveIndexes.add(index);
        duplicates.push(liveSauna);
      }
    }

    merged.push(mergeDuplicateCluster(duplicates));
  }

  for (let index = 0; index < normalizedLive.length; index += 1) {
    if (matchedLiveIndexes.has(index)) continue;
    merged.push(normalizedLive[index]);
  }

  return dedupeSaunas(merged);
}

function mergeDuplicateCluster(saunas) {
  if (!Array.isArray(saunas) || saunas.length === 0) return null;
  if (saunas.length === 1) return saunas[0];

  const sortedByRatingCount = saunas.slice().sort((a, b) => {
    const byCount = getRatingCount(b) - getRatingCount(a);
    if (byCount !== 0) return byCount;

    const ratingA = Number.isFinite(a?.rating) ? a.rating : -1;
    const ratingB = Number.isFinite(b?.rating) ? b.rating : -1;
    return ratingB - ratingA;
  });

  const bestRated = sortedByRatingCount[0];
  const base = saunas[0];

  return {
    ...base,
    rating: Number.isFinite(bestRated?.rating) ? bestRated.rating : base.rating,
    userRatingCount: Number.isFinite(bestRated?.userRatingCount)
      ? bestRated.userRatingCount
      : base.userRatingCount,
    mapsUri: bestRated?.mapsUri || base.mapsUri
  };
}

function getRatingCount(sauna) {
  if (!Number.isFinite(sauna?.userRatingCount)) return -1;
  return sauna.userRatingCount;
}

function renderMarkers(saunas) {
  const nextVisibleIds = new Set();

  for (const sauna of saunas) {
    nextVisibleIds.add(sauna.id);
    state.markerSaunaById.set(sauna.id, sauna);

    let marker = state.markerById.get(sauna.id);
    if (!marker) {
      marker = new google.maps.Marker({
        position: sauna.location,
        title: sauna.name,
        optimized: true
      });

      marker.addListener("click", () => {
        const currentSauna = state.markerSaunaById.get(sauna.id);
        if (!currentSauna) return;

        openInfoWindowForSauna(currentSauna, marker);
      });

      state.markerById.set(sauna.id, marker);
    } else {
      marker.setPosition(sauna.location);
      marker.setTitle(sauna.name);
    }

    if (marker.getMap() !== state.map) {
      marker.setMap(state.map);
    }
  }

  for (const [saunaId, marker] of state.markerById) {
    if (nextVisibleIds.has(saunaId)) continue;

    marker.setMap(null);
    google.maps.event.clearInstanceListeners(marker);
    state.markerById.delete(saunaId);
    state.markerSaunaById.delete(saunaId);
  }
}

function buildInfoWindowHeader(sauna) {
  const header = document.createElement("div");
  header.className = "info-header-title";
  header.textContent = sauna.name;
  return header;
}

function openInfoWindowForSauna(sauna, marker) {
  const supportsHeader = typeof state.infoWindow.setHeaderContent === "function";
  if (supportsHeader) {
    state.infoWindow.setHeaderContent(buildInfoWindowHeader(sauna));
  }
  state.infoWindow.setContent(buildInfoWindowContent(sauna, { includeTitle: !supportsHeader }));
  state.infoWindow.open({ map: state.map, anchor: marker });
}

function buildInfoWindowContent(sauna, options = {}) {
  const { includeTitle = true } = options;
  const wrapper = document.createElement("div");
  wrapper.className = "info-window";

  if (includeTitle) {
    const title = document.createElement("h3");
    title.className = "info-title";
    title.textContent = sauna.name;
    wrapper.append(title);
  }

  if (Number.isFinite(sauna.rating)) {
    const rating = document.createElement("p");
    rating.className = "info-rating";

    const stars = document.createElement("span");
    stars.className = "info-stars";
    stars.setAttribute("aria-hidden", "true");
    stars.textContent = formatRatingStars(sauna.rating);

    const ratingText = document.createElement("span");
    ratingText.className = "info-rating-text";
    const reviewCount = Number.isFinite(sauna.userRatingCount)
      ? ` (${sauna.userRatingCount})`
      : "";
    ratingText.textContent = `${sauna.rating.toFixed(1)}${reviewCount}`;

    rating.append(stars, ratingText);
    wrapper.append(rating);
  }

  const address = document.createElement("p");
  address.className = "info-address";
  address.textContent = sauna.address || t(state.locale, "app.label.addressUnavailable");

  wrapper.append(address);

  const links = document.createElement("div");
  links.className = "info-links";

  const webpageUrl = getLocalizedWebpageUrl(sauna);
  if (webpageUrl) {
    const webpageLink = document.createElement("a");
    webpageLink.href = webpageUrl;
    webpageLink.target = "_blank";
    webpageLink.rel = "noopener noreferrer";
    webpageLink.className = "info-link";
    webpageLink.textContent = "Nettside";
    links.append(webpageLink);
  }

  if (sauna.websiteUri && sauna.websiteUri !== webpageUrl) {
    const websiteLink = document.createElement("a");
    websiteLink.href = sauna.websiteUri;
    websiteLink.target = "_blank";
    websiteLink.rel = "noopener noreferrer";
    websiteLink.className = "info-link";
    websiteLink.textContent = t(state.locale, "app.label.website");
    links.append(websiteLink);
  }

  if (sauna.mapsUri) {
    const link = document.createElement("a");
    link.href = sauna.mapsUri;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "info-link";
    link.textContent = t(state.locale, "app.label.openMaps");
    links.append(link);
  }

  if (links.childElementCount > 0) {
    wrapper.append(links);
  }

  return wrapper;
}

function applyViewport() {
  if (!state.map) return;
  state.isApplyingViewport = true;

  const halfSideKm = state.viewportKm / 2;
  const latDelta = kmToLatitudeDelta(halfSideKm);
  const lngDelta = kmToLongitudeDelta(halfSideKm, state.viewportCenter.lat);

  const southWest = {
    lat: state.viewportCenter.lat - latDelta,
    lng: state.viewportCenter.lng - lngDelta
  };
  const northEast = {
    lat: state.viewportCenter.lat + latDelta,
    lng: state.viewportCenter.lng + lngDelta
  };

  const bounds = new google.maps.LatLngBounds(southWest, northEast);
  state.map.fitBounds(bounds, 24);
  google.maps.event.addListenerOnce(state.map, "idle", () => {
    state.isApplyingViewport = false;
  });
}

function kmToLatitudeDelta(km) {
  return km / 111.32;
}

function kmToLongitudeDelta(km, latitude) {
  const cosLatitude = Math.cos(toRadians(latitude));
  const safeCosine = Math.max(Math.abs(cosLatitude), 0.1);
  return km / (111.32 * safeCosine);
}

async function loadGoogleMapsApi(apiKey) {
  if (window.google?.maps) return;

  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps script failed to load"));
    document.head.append(script);
  });
}

async function loadManualSaunas() {
  try {
    const response = await fetch(MANUAL_SAUNA_DATA_PATH);
    if (!response.ok) {
      if (response.status !== 404) {
        console.error(`Failed to load manual saunas file (${response.status}).`);
      }
      return [];
    }

    const payload = await response.json();
    const rawSaunas = Array.isArray(payload) ? payload : payload?.saunas;
    if (!Array.isArray(rawSaunas)) {
      return [];
    }

    return dedupeSaunas(rawSaunas.map((rawSauna) => normalizeManualSauna(rawSauna)).filter(Boolean));
  } catch (error) {
    console.error("Failed to load manual saunas:", error);
    return [];
  }
}

function normalizeManualSauna(rawSauna) {
  if (!rawSauna || typeof rawSauna !== "object") return null;

  const lat = Number(
    rawSauna?.latitude ??
      rawSauna?.coordinates?.lat ??
      rawSauna?.coordinates?.latitude ??
      rawSauna?.location?.lat ??
      rawSauna?.location?.latitude ??
      rawSauna?.lat
  );
  const lng = Number(
    rawSauna?.longitude ??
      rawSauna?.coordinates?.lng ??
      rawSauna?.coordinates?.longitude ??
      rawSauna?.location?.lng ??
      rawSauna?.location?.longitude ??
      rawSauna?.lng
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return normalizeSauna({
    id: firstNonEmptyString(rawSauna?.uuid, rawSauna?.UUID, rawSauna?.id, rawSauna?.Id),
    name: firstNonEmptyString(rawSauna?.name, rawSauna?.Name),
    location: { lat, lng },
    address: firstNonEmptyString(rawSauna?.address, rawSauna?.Address),
    mapsUri: firstNonEmptyString(
      rawSauna?.mapsUri,
      rawSauna?.googleMapsURI,
      rawSauna?.googleMapsUri,
      buildGoogleMapsUriFromCoordinates({ lat, lng })
    ),
    websiteUri: firstNonEmptyString(rawSauna?.websiteUri, rawSauna?.websiteURL),
    webpageUrlNo: firstNonEmptyString(
      rawSauna?.webpageUrlNo,
      rawSauna?.webpageUrlNb,
      rawSauna?.webpageUrlNorwegian,
      rawSauna?.moreInfoUrlNo,
      rawSauna?.moreInfoUrlNb,
      rawSauna?.moreInfoUrlNorwegian,
      rawSauna?.["More info URL (norwegian)"]
    ),
    webpageUrlEn: firstNonEmptyString(
      rawSauna?.webpageUrlEn,
      rawSauna?.webpageUrlEnglish,
      rawSauna?.moreInfoUrlEn,
      rawSauna?.moreInfoUrlEnglish,
      rawSauna?.["More info URL (english)"]
    )
  });
}

async function fetchLiveSaunas(center, options = {}) {
  const { radiusMeters = LIVE_SEARCH_RADIUS_METERS } = options;

  try {
    const Place = await getPlaceClass();
    if (!Place || typeof Place.searchByText !== "function") {
      return [];
    }

    const requests = LIVE_TEXT_QUERIES.map((textQuery) =>
      Place.searchByText({
        textQuery,
        fields: [
          "id",
          "displayName",
          "formattedAddress",
          "location",
          "googleMapsURI",
          "websiteURI",
          "rating",
          "userRatingCount"
        ],
        locationBias: {
          center,
          radius: radiusMeters
        },
        maxResultCount: LIVE_RESULT_LIMIT,
        language: navigator.language || "en-US"
      })
    );

    const responses = await Promise.allSettled(requests);
    const liveSaunas = [];

    for (const result of responses) {
      if (result.status === "fulfilled") {
        for (const place of result.value?.places || []) {
          const sauna = normalizeDynamicPlace(place);
          if (sauna) {
            liveSaunas.push(sauna);
          }
        }
      } else {
        console.error("Live sauna query failed:", result.reason);
      }
    }

    return dedupeSaunas(liveSaunas);
  } catch (error) {
    console.error("Live sauna fetch failed:", error);
    return [];
  }
}

async function getPlaceClass() {
  if (!placeClassPromise) {
    placeClassPromise = google.maps.importLibrary("places").then((library) => library.Place);
  }
  return placeClassPromise;
}

function normalizeDynamicPlace(place) {
  const lat =
    typeof place?.location?.lat === "function"
      ? place.location.lat()
      : Number(place?.location?.lat);
  const lng =
    typeof place?.location?.lng === "function"
      ? place.location.lng()
      : Number(place?.location?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const displayName =
    typeof place?.displayName === "string"
      ? place.displayName
      : place?.displayName?.text || t(state.locale, "app.label.unknownSauna");

  return normalizeSauna(
    {
      id: place?.id,
      name: displayName,
      address: place?.formattedAddress,
      mapsUri: place?.googleMapsURI || place?.googleMapsUri,
      websiteUri: place?.websiteURI || place?.websiteUri,
      rating: place?.rating,
      userRatingCount: place?.userRatingCount,
      location: { lat, lng }
    }
  );
}

function normalizeSauna(rawSauna) {
  if (!rawSauna || typeof rawSauna !== "object") return null;

  const lat = Number(
    rawSauna?.location?.lat ?? rawSauna?.location?.latitude ?? rawSauna?.lat ?? rawSauna?.latitude
  );
  const lng = Number(
    rawSauna?.location?.lng ?? rawSauna?.location?.longitude ?? rawSauna?.lng ?? rawSauna?.longitude
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const name = String(
    rawSauna?.name || rawSauna?.Name || rawSauna?.displayName || t(state.locale, "app.label.unknownSauna")
  ).trim();
  const id = String(rawSauna?.id || rawSauna?.uuid || rawSauna?.placeId || "").trim();
  if (!id) return null;

  return {
    id,
    name,
    address: String(rawSauna?.address || rawSauna?.Address || rawSauna?.formattedAddress || "").trim(),
    mapsUri: normalizeUrl(rawSauna?.mapsUri || rawSauna?.googleMapsUri || rawSauna?.googleMapsURI),
    websiteUri: normalizeUrl(rawSauna?.websiteUri || rawSauna?.websiteURI),
    webpageUrlNo: normalizeUrl(
      rawSauna?.webpageUrlNo ||
        rawSauna?.webpageUrlNb ||
        rawSauna?.webpageUrlNorwegian ||
        rawSauna?.moreInfoUrlNo ||
        rawSauna?.moreInfoUrlNb ||
        rawSauna?.moreInfoUrlNorwegian ||
        rawSauna?.["More info URL (norwegian)"]
    ),
    webpageUrlEn: normalizeUrl(
      rawSauna?.webpageUrlEn ||
        rawSauna?.webpageUrlEnglish ||
        rawSauna?.moreInfoUrlEn ||
        rawSauna?.moreInfoUrlEnglish ||
        rawSauna?.["More info URL (english)"]
    ),
    rating: normalizeRating(rawSauna?.rating),
    userRatingCount: normalizeUserRatingCount(rawSauna?.userRatingCount),
    location: { lat, lng }
  };
}

function getLocalizedWebpageUrl(sauna) {
  if (!sauna || typeof sauna !== "object") return "";
  if (state.locale === "nb") {
    return sauna.webpageUrlNo || sauna.webpageUrlEn || "";
  }
  return sauna.webpageUrlEn || sauna.webpageUrlNo || "";
}

function normalizeRating(value) {
  const rating = Number(value);
  if (!Number.isFinite(rating)) return null;
  return clamp(rating, 0, 5);
}

function normalizeUserRatingCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count < 0) return null;
  return Math.round(count);
}

function formatRatingStars(rating) {
  const rounded = Math.round(clamp(rating, 0, 5));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

function dedupeSaunas(saunas) {
  const map = new Map();
  for (const sauna of saunas) {
    if (!sauna) continue;
    map.set(sauna.id, sauna);
  }
  return Array.from(map.values());
}

function getNearbySaunas(saunas, center) {
  if (!Array.isArray(saunas) || saunas.length === 0) return [];

  const sortedByDistance = saunas
    .slice()
    .sort(
      (a, b) =>
        haversineDistanceMeters(center, a.location) - haversineDistanceMeters(center, b.location)
    );

  const nearby = [];
  for (const sauna of sortedByDistance) {
    if (haversineDistanceMeters(center, sauna.location) <= NEARBY_RADIUS_METERS) {
      nearby.push(sauna);
      if (nearby.length >= MAX_VISIBLE_SAUNAS) break;
    }
  }

  if (nearby.length > 0) {
    return nearby;
  }

  return sortedByDistance.slice(0, MAX_VISIBLE_SAUNAS);
}

function haversineDistanceMeters(a, b) {
  const earthRadius = 6371000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function getUserLocation() {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      () => resolve(null),
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 180000
      }
    );
  });
}

function wireSearchAreaInteractions(elements) {
  elements.searchAreaButton.addEventListener("click", () => {
    void searchCurrentArea(elements);
  });
  elements.myLocationButton.addEventListener("click", () => {
    void goToMyLocation(elements);
  });

  state.map.addListener("dragend", () => {
    handleMapViewportChange(elements);
  });

  state.map.addListener("zoom_changed", () => {
    handleMapViewportChange(elements);
  });
}

function handleMapViewportChange(elements) {
  if (!state.readyForAreaSearch || state.isApplyingViewport || !state.map) {
    return;
  }

  if (!hasViewportChangedSinceLastSearch()) {
    return;
  }

  setSearchAreaButtonVisible(elements, true);
}

function hasViewportChangedSinceLastSearch() {
  const center = getCurrentMapCenter();
  if (!center || !state.lastSearchCenter || !state.map) return false;

  const movedMeters = haversineDistanceMeters(center, state.lastSearchCenter);
  const zoom = state.map.getZoom();
  const zoomChanged = typeof zoom === "number" && zoom !== state.lastSearchZoom;

  return movedMeters > 150 || zoomChanged;
}

async function searchCurrentArea(elements) {
  if (!state.map) return;

  const center = getCurrentMapCenter();
  if (!center) return;

  state.activeCenter = center;
  const radiusMeters = getSearchRadiusMetersFromMap(center);

  setSearchAreaButtonBusy(elements, true);

  const liveResults = await fetchLiveSaunas(center, {
    radiusMeters
  });

  state.liveSaunas = dedupeSaunas(liveResults);
  refreshUi();
  captureSearchViewport(elements);
  setSearchAreaButtonBusy(elements, false);
}

async function goToMyLocation(elements) {
  if (!state.map) return;

  setMyLocationButtonBusy(elements, true);

  const userLocation = state.userLocation || (await getUserLocation());
  if (!userLocation) {
    state.userLocation = null;
    setMyLocationButtonBusy(elements, false);
    return;
  }

  state.userLocation = userLocation;
  state.activeCenter = userLocation;
  state.viewportCenter = userLocation;
  state.viewportKm = VIEWPORT_KM_WITH_LOCATION;
  applyViewport();
  await waitForMapIdle();

  const radiusMeters = getSearchRadiusMetersFromMap(userLocation);
  const liveResults = await fetchLiveSaunas(userLocation, {
    radiusMeters
  });

  state.liveSaunas = dedupeSaunas(liveResults);
  refreshUi();
  captureSearchViewport(elements);
  setMyLocationButtonBusy(elements, false);
}

function captureSearchViewport(elements) {
  const center = getCurrentMapCenter();
  if (!center || !state.map) return;

  state.lastSearchCenter = center;
  state.lastSearchZoom = state.map.getZoom();
  setSearchAreaButtonVisible(elements, false);
}

function getCurrentMapCenter() {
  if (!state.map) return null;
  const center = state.map.getCenter();
  if (!center) return null;
  return { lat: center.lat(), lng: center.lng() };
}

function waitForMapIdle() {
  if (!state.map) return Promise.resolve();
  return new Promise((resolve) => {
    google.maps.event.addListenerOnce(state.map, "idle", resolve);
  });
}

function getSearchRadiusMetersFromMap(center) {
  if (!state.map) return LIVE_SEARCH_RADIUS_METERS;
  const bounds = state.map.getBounds();
  if (!bounds) return LIVE_SEARCH_RADIUS_METERS;

  const northPoint = { lat: bounds.getNorthEast().lat(), lng: center.lng };
  const eastPoint = { lat: center.lat, lng: bounds.getNorthEast().lng() };

  const radiusNorth = haversineDistanceMeters(center, northPoint);
  const radiusEast = haversineDistanceMeters(center, eastPoint);
  const radius = Math.max(radiusNorth, radiusEast);

  return clamp(Math.round(radius), 2000, 50000);
}

function setSearchAreaButtonVisible(elements, visible) {
  if (visible) {
    elements.searchAreaButton.classList.remove("is-hidden");
  } else {
    elements.searchAreaButton.classList.add("is-hidden");
  }
}

function setSearchAreaButtonBusy(elements, busy) {
  elements.searchAreaButton.disabled = busy;
  elements.searchAreaButton.textContent = busy
    ? t(state.locale, "app.searchArea.searching")
    : t(state.locale, "app.searchArea.button");
}

function setMyLocationButtonBusy(elements, busy) {
  elements.myLocationButton.disabled = busy;
  elements.myLocationButton.classList.toggle("is-busy", busy);

  const label = busy
    ? t(state.locale, "app.location.locating")
    : t(state.locale, "app.location.button");
  elements.myLocationButton.setAttribute("aria-label", label);
  elements.myLocationButton.setAttribute("title", label);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function buildGoogleMapsUriFromCoordinates(location) {
  if (!location) return "";
  const lat = Number(location.lat);
  const lng = Number(location.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${lat},${lng}`
  )}`;
}

function normalizeUrl(value) {
  return String(value || "").trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
