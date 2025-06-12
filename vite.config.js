import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/pathfinding-projects.github.io/",
  plugins: [tailwindcss(), react()],
  build: {
    outDir: "docs"
  }
});
