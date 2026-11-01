import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import {
  validateProductionEnv,
  validateEmulatorEnv,
} from "./scripts/production-env.mjs";
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && mode !== "emulator") validateProductionEnv(env);
  if (mode === "emulator") validateEmulatorEnv(env);
  return {
    base: "/",
    plugins: [tailwindcss()],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      target: "es2022",
      minify: "esbuild",
      cssMinify: "esbuild",
      cssCodeSplit: true,
      sourcemap: false,
      reportCompressedSize: true,
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash][extname]",
          manualChunks(id) {
            const path = id.replaceAll("\\", "/");
            if (/\/node_modules\/(?:@firebase|firebase)\/auth\//.test(path))
              return "firebase-auth";
            if (
              /\/node_modules\/(?:@firebase|firebase)\/firestore\//.test(
                path,
              ) ||
              path.includes("/node_modules/@firebase/webchannel-wrapper/")
            )
              return "firebase-firestore";
            if (
              /\/node_modules\/(?:@firebase|firebase)\/functions\//.test(path)
            )
              return "firebase-functions";
            if (
              path.includes("/node_modules/@firebase/") ||
              path.includes("/node_modules/firebase/")
            )
              return "firebase-core";
            if (/\/node_modules\/(?:react|react-dom|scheduler)\//.test(path))
              return "react";
          },
        },
      },
    },
  };
});
