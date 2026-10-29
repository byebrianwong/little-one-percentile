import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, spyOn } from "storybook/test";
import Home from "./page";
import { DEFAULT_PREFS, MAYA, PHONE, seedStorage } from "@/stories/fixtures";

/** The whole home page, as it is served at /. */
const meta = {
  title: "Pages/Home",
  component: Home,
  parameters: { layout: "fullscreen" },
  beforeEach() {
    // App copies the chart settings into the URL (see App.stories).
    spyOn(history, "replaceState").mockImplementation(() => {});
    return seedStorage();
  },
} satisfies Meta<typeof Home>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("heading", { level: 1 })).toHaveTextContent("Where does your baby sit on the growth chart?");
    await expect(canvas.getByRole("link", { name: "WHO Child Growth Standards" })).toHaveAttribute(
      "href",
      "https://www.who.int/tools/child-growth-standards",
    );
  },
};

export const Phone: Story = { ...PHONE };

/** On a phone the baby panel sits above the chart. */
export const PhoneWithABaby: Story = {
  ...PHONE,
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvas }) => {
    const panel = await canvas.findByRole("region", { name: "Your baby" });
    const chart = canvas.getByRole("region", { name: "Growth chart" });
    await expect(panel.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(chart.getBoundingClientRect().top);
  },
};
