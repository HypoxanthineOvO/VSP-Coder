import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react-markdown") || id.includes("node_modules/remark-") || id.includes("node_modules/rehype-") || id.includes("node_modules/katex") || id.includes("node_modules/unified") || id.includes("node_modules/mdast") || id.includes("node_modules/hast")) {
            return "markdown";
          }
        }
      }
    }
  },
  server: {
    proxy: {
      "/api": process.env.VITE_API_TARGET || `http://localhost:${process.env.PORT || process.env.VSP_CODER_PORT || "4180"}`
    }
  }
});
