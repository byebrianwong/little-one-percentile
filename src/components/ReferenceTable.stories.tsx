import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, within } from "storybook/test";
import ReferenceTable from "./ReferenceTable";

const meta = {
  title: "Explore/ReferenceTable",
  component: ReferenceTable,
  args: { sex: "girl", metric: "weight", units: "imperial", onPick: fn() },
} satisfies Meta<typeof ReferenceTable>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The table starts folded away under its title. */
export const Closed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Full table: girls' weight by age")).toBeVisible();
    await expect(canvas.getByRole("table", { hidden: true })).not.toBeVisible();
  },
};

export const Open: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Full table: girls' weight by age"));
    await expect(canvas.getByRole("table")).toBeVisible();
    // Birth to 13 weeks by week, then 13 ages from 4 months to 2 years, plus the header row.
    await expect(canvas.getAllByRole("row")).toHaveLength(28);
  },
};

export const BoysHeadInCentimetres: Story = {
  args: { sex: "boy", metric: "head", units: "metric" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Full table: boys' head circumference by age"));
    const birth = canvas.getByRole("row", { name: /^Birth/ });
    await expect(within(birth).getAllByRole("button")).toHaveLength(7);
    await expect(within(birth).getAllByRole("button")[0]).toHaveTextContent(/ cm$/);
  },
};

/** Clicking a value shows that age and percentile on the chart. */
export const PickAValue: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Full table: girls' weight by age"));
    const row = canvas.getByRole("row", { name: /^13 weeks/ });
    // Columns are the 3rd, 10th, 25th, 50th, 75th, 90th and 97th percentiles.
    await userEvent.click(within(row).getAllByRole("button")[3]);
    await expect(args.onPick).toHaveBeenCalledWith(91, 50);
  },
};
