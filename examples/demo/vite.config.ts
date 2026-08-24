import { defineConfig } from "vite";
import frontendHelper from "@frontend-helper/vite";

export default defineConfig({
  plugins: [
    frontendHelper({
      hotkey: "Alt+Shift+H",
      initiallyOpen: true,
    }),
  ],
});
