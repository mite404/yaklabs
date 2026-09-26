import type { StorybookConfig } from "@storybook/react-vite";

// Stories stay beside their components in the catalog package; this app only hosts them.
const config: StorybookConfig = {
  stories: ["../../../packages/catalog/src/**/*.stories.tsx"],
  framework: "@storybook/react-vite",
  addons: ["@storybook/addon-vitest", "@storybook/addon-a11y"],
};
export default config;
