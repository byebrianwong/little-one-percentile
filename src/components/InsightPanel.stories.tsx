import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn } from "storybook/test";
import InsightPanel from "./InsightPanel";
import { valueAtPercentile } from "@/lib/growth";
import { insightFor } from "@/lib/insight";

const meta = {
  title: "Chart/InsightPanel",
  component: InsightPanel,
  decorators: [
    (Story) => (
      <div className="card max-w-3xl p-5">
        <Story />
      </div>
    ),
  ],
  args: {
    part: "headline",
    mode: "explore",
    sex: "girl",
    metric: "weight",
    units: "imperial",
    insight: insightFor("weight", "girl", 91, valueAtPercentile("weight", "girl", 91, 50)),
    babyName: "",
    onSaveProbe: fn(),
  },
} satisfies Meta<typeof InsightPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sentence above the chart while exploring. */
export const ExploreHeadline: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/At 13 weeks, a girl on the/)).toHaveTextContent(
      "At 13 weeks, a girl on the 50th percentile weighs 12 lb 14 oz.",
    );
  },
};

/** A pinned point reads as "this value is the Nth percentile". */
export const PinnedHeadline: Story = {
  args: { mode: "probe", insight: insightFor("weight", "girl", 91, 6.4) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/At 13 weeks,/)).toHaveTextContent("At 13 weeks, 14 lb 2 oz is the 77th percentile for girls.");
  },
};

export const BabyHeadline: Story = {
  args: { mode: "baby", babyName: "Maya", insight: insightFor("weight", "girl", 122, 6.5) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Maya weighs/)).toHaveTextContent("At 4 months, Maya weighs 14 lb 5 oz (54th percentile).");
  },
};

/** Without a name the sentence says "your baby". */
export const BabyHeadlineWithoutAName: Story = {
  args: { mode: "baby", metric: "length", units: "metric", insight: insightFor("length", "girl", 98, 61.2) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/your baby is/)).toBeInTheDocument();
  },
};

export const PinnedHeadSize: Story = {
  args: { mode: "probe", metric: "head", sex: "boy", units: "metric", insight: insightFor("head", "boy", 182.625, 44) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/head is the/)).toHaveTextContent(/At 6 months, a 44\.0 cm head is the \d+\w\w percentile for boys\./);
  },
};

/** Past the ends of the chart the sentence says "below the 1st" instead of a number. */
export const BelowTheFirstPercentile: Story = {
  args: { mode: "probe", insight: insightFor("weight", "girl", 91, valueAtPercentile("weight", "girl", 91, 0.3)) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/below the 1st percentile/)).toBeInTheDocument();
  },
};

/** The details under the chart while exploring. */
export const ExploreDetails: Story = {
  args: { part: "details" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("About 50 in 100 girls this age weigh less.")).toBeInTheDocument();
    await expect(canvas.getByText("Right on the median.")).toBeInTheDocument();
    await expect(canvas.getByText("If staying on the 50th")).toBeInTheDocument();
    // A pinned point can be saved; exploring has nothing to save.
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

/** A pinned point offers to save it as the baby's measurement. */
export const PinnedDetailsCanBeSaved: Story = {
  args: { part: "details", mode: "probe", insight: insightFor("weight", "girl", 91, 6.4) },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText(/above the median/)).toBeInTheDocument();
    await expect(canvas.getByText("90th")).toBeInTheDocument();
    await expect(canvas.getByText("75th")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Save as my baby’s measurement" }));
    await expect(args.onSaveProbe).toHaveBeenCalledOnce();
  },
};

export const BabyDetails: Story = {
  args: { part: "details", mode: "baby", babyName: "Maya", insight: insightFor("weight", "girl", 122, 6.5) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("If they stay on the 54th")).toBeInTheDocument();
  },
};

export const ShorterThanMost: Story = {
  args: {
    part: "details",
    mode: "probe",
    metric: "length",
    units: "metric",
    insight: insightFor("length", "girl", 182.625, valueAtPercentile("length", "girl", 182.625, 0.3)),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Fewer than 1 in 100 girls this age are shorter.")).toBeInTheDocument();
  },
};

export const BiggerHeadThanAlmostAll: Story = {
  args: {
    part: "details",
    mode: "probe",
    metric: "head",
    sex: "boy",
    insight: insightFor("head", "boy", 365.25, valueAtPercentile("head", "boy", 365.25, 99.7)),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("More than 99 in 100 boys this age have a smaller head.")).toBeInTheDocument();
  },
};

/** At 2 years there is nothing left to project. */
export const AtTwoYears: Story = {
  args: { part: "details", insight: insightFor("weight", "girl", 730, valueAtPercentile("weight", "girl", 730, 25)) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("The WHO charts end at 2 years.")).toBeInTheDocument();
  },
};
