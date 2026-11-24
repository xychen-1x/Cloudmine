import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({ test: { environment: "node", include: ["tests/**/*.test.ts"], clearMocks: true, restoreMocks: true }, resolve: { alias: [{ find: /^server-only$/, replacement: path.join(root, "tests/stubs/server-only.ts") }] } });
