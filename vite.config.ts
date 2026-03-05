import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  const derivedUrl = env.VITE_SUPABASE_PROJECT_ID
    ? `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`
    : "";

  const resolvedSupabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || derivedUrl;
  const resolvedSupabaseAnonKey =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    env.SUPABASE_PUBLISHABLE_KEY ||
    "";

  const resolvedProjectId =
    env.VITE_SUPABASE_PROJECT_ID ||
    (resolvedSupabaseUrl.match(/^https:\/\/([^.]+)\.supabase\.co$/)?.[1] ?? "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        env.VITE_SUPABASE_URL || resolvedSupabaseUrl
      ),
      "import.meta.env.SUPABASE_URL": JSON.stringify(env.SUPABASE_URL || resolvedSupabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        env.VITE_SUPABASE_PUBLISHABLE_KEY || resolvedSupabaseAnonKey
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || resolvedSupabaseAnonKey
      ),
      "import.meta.env.SUPABASE_ANON_KEY": JSON.stringify(
        env.SUPABASE_ANON_KEY || resolvedSupabaseAnonKey
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(resolvedProjectId),
    },
  };
});
