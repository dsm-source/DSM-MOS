// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          // Split heavy client vendors out of the main bundle so the initial
          // chunk stays under the 500 kB warning threshold and long-tail deps
          // (charts, drag-and-drop, date utils) load on their own.
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)
            )
              return "react";
            if (id.includes("@tanstack")) return "tanstack";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("@dnd-kit")) return "dnd";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("date-fns") || id.includes("lucide-react"))
              return "ui-utils";
            if (id.includes("@supabase") || id.includes("supabase"))
              return "supabase";
            if (
              id.includes("react-hook-form") ||
              id.includes("@hookform") ||
              id.includes("zod")
            )
              return "forms";
          },
        },
      },
    },
  },
});
