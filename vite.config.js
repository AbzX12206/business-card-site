import { defineConfig } from "vite";
import htmlTemplate from "./build/html-template.js";

export default defineConfig({
  plugins: [htmlTemplate()],
  build: { target: "es2020" },
});
