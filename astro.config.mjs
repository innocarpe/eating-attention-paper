import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import preact from "@astrojs/preact";

const site = new URL(process.env.SITE_URL ?? "http://localhost:4321");
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  site: site.href,
  base,
  output: "static",
  integrations: [mdx(), preact()],
  vite: {
    build: {
      cssMinify: "lightningcss",
      minify: "esbuild",
      sourcemap: false,
    },
  },
});
