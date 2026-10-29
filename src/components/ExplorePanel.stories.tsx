import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, waitFor } from "storybook/test";
import ExplorePanel from "./ExplorePanel";
import { percentileFromValue } from "@/lib/growth";

const meta = {
  title: "Explore/ExplorePanel",
  component: ExplorePanel,
  decorators: [
    (Story) => (
      <div className="max-w-[340px]">
        <Story />
      </div>
    ),
  ],
  args: {
    sex: "girl",
    metric: "weight",
    units: "imperial",
    ageDays: 91,
    hoverAge: null,
    percentile: 50,
    active: true,
    marker: null,
    onAge: fn(),
    onPercentile: fn(),
  },
  // The panel only reports a new age or percentile; App holds them. This keeps them here instead,
  // so the controls respond in Storybook too.
  render: function Render(args) {
    const [ageDays, setAgeDays] = useState(args.ageDays);
    const [percentile, setPercentile] = useState(args.percentile);
    return (
      <ExplorePanel
        {...args}
        ageDays={ageDays}
        percentile={percentile}
        onAge={(d) => {
          setAgeDays(d);
          args.onAge(d);
        }}
        onPercentile={(p) => {
          setPercentile(p);
          args.onPercentile(p);
        }}
      />
    );
  },
} satisfies Meta<typeof ExplorePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Girls at 13 weeks")).toBeInTheDocument();
    await expect(canvas.getAllByRole("row")).toHaveLength(7);
  },
};

/** A percentile that is not one of the standard lines gets its own row. */
export const AnyPercentile: Story = {
  args: { percentile: 33 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("33rd")).toBeInTheDocument();
    await expect(canvas.getAllByRole("row")).toHaveLength(8);
  },
};

/** While the pointer is over the chart, the table follows its age. */
export const FollowingThePointer: Story = {
  args: { hoverAge: 182.625 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Girls at 6 months")).toBeInTheDocument();
    await expect(canvas.getByText("following pointer")).toBeInTheDocument();
  },
};

/** A baby's measurement is shown as its own row, between the lines it falls between. */
export const WithTheBabysRow: Story = {
  args: {
    ageDays: 122,
    active: false,
    marker: { label: "Maya", value: 6.5, percentile: percentileFromValue("weight", "girl", 122, 6.5) },
  },
  play: async ({ canvas }) => {
    const rows = canvas.getAllByRole("row");
    const maya = rows.findIndex((r) => r.textContent?.startsWith("Maya"));
    await expect(rows[maya]).toHaveTextContent("Maya (54th)14 lb 5 oz");
    await expect(rows[maya - 1]).toHaveTextContent(/^75th/);
    await expect(rows[maya + 1]).toHaveTextContent(/^50th/);
  },
};

export const MarkerBelowEveryLine: Story = {
  args: { active: false, marker: { label: "Pinned", value: 4, percentile: 0.4 } },
  play: async ({ canvas }) => {
    const rows = canvas.getAllByRole("row");
    await expect(rows[rows.length - 1]).toHaveTextContent(/^Pinned \(below 1st\)/);
  },
};

export const BoysHeadInCentimetres: Story = {
  args: { sex: "boy", metric: "head", units: "metric", ageDays: 365.25 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Boys at 1 year")).toBeInTheDocument();
    await expect(canvas.getAllByText(/ cm$/)).toHaveLength(7);
  },
};

export const PickAPercentile: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("90th"));
    await expect(args.onPercentile).toHaveBeenLastCalledWith(90);
    await userEvent.click(canvas.getByRole("button", { name: "10" }));
    await expect(args.onPercentile).toHaveBeenLastCalledWith(10);
  },
};

/** Any whole percentile from 1 to 99 can be typed. Anything else is ignored. */
export const TypeAnyPercentile: Story = {
  play: async ({ args, canvas }) => {
    const input = canvas.getByRole("spinbutton", { name: "Choose any percentile from 1 to 99" });
    await fireEvent.change(input, { target: { value: "33" } });
    await expect(args.onPercentile).toHaveBeenLastCalledWith(33);
    await expect(await canvas.findByText("33rd")).toBeInTheDocument();

    await fireEvent.change(input, { target: { value: "150" } });
    await fireEvent.change(input, { target: { value: "0" } });
    await expect(args.onPercentile).toHaveBeenCalledTimes(1);
  },
};

/** The steppers move one notch along the ages the chart uses; the shortcuts jump. */
export const ChangeTheAge: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Older" }));
    await expect(args.onAge).toHaveBeenLastCalledWith(98);
    await userEvent.click(canvas.getByRole("button", { name: "Younger" }));
    await userEvent.click(canvas.getByRole("button", { name: "Younger" }));
    await expect(args.onAge).toHaveBeenLastCalledWith(84);
    await userEvent.click(canvas.getByRole("button", { name: "6 mo" }));
    await expect(args.onAge).toHaveBeenLastCalledWith(182.625);
    const slider = canvas.getByRole("slider", { name: "Age" });
    await expect(slider).toHaveAttribute("aria-valuetext", "6 months");
    // The slider moves through the same ages, by position.
    await fireEvent.change(slider, { target: { value: "0" } });
    await expect(args.onAge).toHaveBeenLastCalledWith(0);
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuetext", "birth"));
  },
};

/** At birth there is nothing younger. */
export const AtBirth: Story = {
  args: { ageDays: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Younger" })).toBeDisabled();
    await expect(canvas.getByRole("button", { name: "Older" })).toBeEnabled();
    await expect(canvas.getByText("Girls at birth")).toBeInTheDocument();
  },
};
