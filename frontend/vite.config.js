import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const frontendDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./react-app", import.meta.url)),
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: {
    outDir: `${frontendDirectory}/dist`,
    emptyOutDir: true,
  },
});
