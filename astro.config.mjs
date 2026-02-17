import { defineConfig } from "astro/config";

function normalizeBasePath(value) {
  if (!value) return "/";

  let base = value.trim();
  if (!base.startsWith("/")) {
    base = `/${base}`;
  }
  if (!base.endsWith("/")) {
    base = `${base}/`;
  }

  return base;
}

const site = process.env.ASTRO_SITE || "https://finnbadstu.no";
const base = normalizeBasePath(process.env.ASTRO_BASE || "/");

export default defineConfig({
  site,
  base,
  output: "static",
  build: {
    format: "directory",
    inlineStylesheets: "never"
  },
  vite: {
    build: {
      target: "es2022"
    }
  }
});
