import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";

import { playwright } from "@vitest/browser-playwright";

const dirname = typeof __dirname !== "undefined" ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Runs every story as a test in Chromium: it must render, pass its play function and pass the
// accessibility checks. The growth math has its own tests in tests/, run with `npm test`.
// More info: https://storybook.js.org/docs/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // The root layout only loads fonts and the Open Graph image runs on the server. Neither renders in a story.
      exclude: ["src/**/*.stories.tsx", "src/stories/**", "src/app/layout.tsx", "src/app/opengraph-image.tsx"],
      reporter: ["text", "html"],
    },
    projects: [
      {
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, ".storybook") })],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
            // Wide enough for the desktop layout. Stories that need a phone set their own viewport.
            viewport: { width: 1280, height: 900 },
          },
        },
      },
    ],
  },
});
