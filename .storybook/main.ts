import type { StorybookConfig } from "@storybook/nextjs-vite";
import tailwindcss from "@tailwindcss/vite";
import { mergeConfig } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@chromatic-com/storybook", "@storybook/addon-vitest", "@storybook/addon-a11y", "@storybook/addon-docs"],
  framework: "@storybook/nextjs-vite",
  // The app builds its CSS with Tailwind's Turbopack loader (next.config.ts). Storybook builds with Vite,
  // so it needs Tailwind's Vite plugin to turn globals.css into the same styles.
  viteFinal: (config) => mergeConfig(config, { plugins: [tailwindcss()] }),
};

export default config;
