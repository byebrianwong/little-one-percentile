import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import { ExploreControls } from "./ExplorePanel";

/** The age and percentile controls. On wide screens they sit in the explore panel; on phones, under the chart. */
const meta = {
  title: "Explore/ExploreControls",
  component: ExploreControls,
  decorators: [
    (Story) => (
      <div className="card flex max-w-[375px] flex-col gap-5 p-5">
        <Story />
      </div>
    ),
  ],
  args: { idPrefix: "story", ageDays: 91, percentile: 50, active: true, onAge: fn(), onPercentile: fn() },
} satisfies Meta<typeof ExploreControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Exploring: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "50" })).toHaveAttribute("data-on");
  },
};

/** While a pinned point or the baby is shown, the age follows it and no percentile is highlighted. */
export const ShowingAPoint: Story = {
  args: { active: false, ageDays: 30.4375 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("1 month")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "50" })).not.toHaveAttribute("data-on");
    await expect(canvas.getByRole("button", { name: "1 mo" })).not.toHaveAttribute("data-on");
  },
};

/** At 2 years there is nothing older. */
export const AtTwoYears: Story = {
  args: { ageDays: 730 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Older" })).toBeDisabled();
  },
};
