import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // رفع حد التحذير بعد التقسيم (لتفادي ضوضاء غير مفيدة في log النشر).
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // تقسيم يدوي للمكتبات الثقيلة في chunks منفصلة.
        // يُسرّع build، ويُقلّل وقت النشر، ويُحسّن caching المتصفح
        // (المستخدم لا يُعيد تنزيل recharts/framer-motion عند كل تعديل).
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "lucide-react",
          ],
          "charts-vendor": ["recharts"],
          "motion-vendor": ["framer-motion"],
          "supabase-vendor": ["@supabase/supabase-js"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "date-vendor": ["date-fns", "hijri-converter"],
          "docs-vendor": ["docx", "xlsx", "pptxgenjs"],
        },
      },
    },
  },
}));
