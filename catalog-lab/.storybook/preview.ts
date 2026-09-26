import type { Decorator, Preview } from "@storybook/react-vite";
import { trackInputModality } from "../src/inputModality";
import "../src/tokens.css";

trackInputModality();

// Dark mode is set on the root element, the way the app would (ADR-046).
const withTheme: Decorator = (Story, context) => {
  document.documentElement.dataset.theme = context.globals.theme === "dark" ? "dark" : "light";
  return Story();
};

const preview: Preview = {
  parameters: { layout: "padded" },
  globalTypes: {
    theme: {
      description: "Light or dark mode",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme],
};

export default preview;
