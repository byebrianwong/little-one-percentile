import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, spyOn, waitFor, within } from "storybook/test";
import GrowthChart from "./GrowthChart";
import { RANGES } from "@/lib/ages";
import { zFromValue } from "@/lib/growth";
import { MAYA } from "@/stories/fixtures";

const range = (id: string) => RANGES.find((r) => r.id === id)!;

const mayaWeights = MAYA.measurements.map((m) => ({ id: m.id, ageDays: m.ageDays, value: m.weight! }));
const latest = mayaWeights[mayaWeights.length - 1];

const meta = {
  title: "Chart/GrowthChart",
  component: GrowthChart,
  decorators: [
    (Story) => (
      <div className="card max-w-3xl p-5">
        <Story />
      </div>
    ),
  ],
  args: {
    sex: "girl",
    metric: "weight",
    units: "imperial",
    range: range("6m"),
    explore: { ageDays: 91, percentile: 50 },
    probe: null,
    babyPoints: [],
    projectFrom: null,
    selectedId: null,
    onHoverAge: fn(),
    onProbe: fn(),
    onSelectBaby: fn(),
  },
  beforeEach() {
    // fireEvent sends synthetic pointer events, which the browser will not capture. The chart only
    // captures the pointer so a drag keeps working outside the plot, which these tests do not need.
    spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
    spyOn(Element.prototype, "releasePointerCapture").mockImplementation(() => {});
  },
} satisfies Meta<typeof GrowthChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The plot area that receives pointer events. */
function plot(canvas: HTMLElement) {
  return canvas.querySelector<SVGRectElement>('rect[fill="transparent"]')!;
}

/** Client coordinates at a fraction of the plot's width and height, from its top left. */
function at(el: Element, fx: number, fy: number) {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + fx * r.width, clientY: r.top + fy * r.height };
}

/** The chart draws at a placeholder width until it has measured itself. */
async function measured(canvas: HTMLElement) {
  await waitFor(() => expect(canvas.querySelector("svg")).toHaveAttribute("height"));
}

export const Explore: Story = {};

/** A percentile that is not one of the printed lines gets its own label at the right edge. */
export const ExploreAnyPercentile: Story = {
  args: { explore: { ageDays: 182.625, percentile: 33 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("33rd")).toBeInTheDocument();
  },
};

export const BoysLengthToTwoYears: Story = {
  args: { sex: "boy", metric: "length", units: "metric", range: range("2y"), explore: { ageDays: 365.25, percentile: 90 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("img", { name: /Boys' length percentiles from birth to 2 years/ })).toBeInTheDocument();
    await expect(canvas.getByText("cm")).toBeInTheDocument();
  },
};

/** The 3-month range marks every week instead of every month. */
export const HeadByWeek: Story = {
  args: { metric: "head", range: range("3m"), explore: { ageDays: 28, percentile: 25 } },
  play: async ({ canvasElement, canvas }) => {
    await measured(canvasElement);
    await expect(canvas.getByText("Birth")).toBeInTheDocument();
    await expect(canvas.getByText("13w")).toBeInTheDocument();
  },
};

/** A point pinned on the chart, with the dashed line showing where it would be on the same percentile. */
export const PinnedPoint: Story = {
  args: {
    explore: null,
    probe: { ageDays: 91, value: 6.4 },
    projectFrom: { ageDays: 91, value: 6.4, z: zFromValue("weight", "girl", 91, 6.4) },
  },
};

/** A baby's checkups joined by a line, the latest one selected and projected forward. */
export const BabyHistory: Story = {
  args: {
    explore: null,
    babyPoints: mayaWeights,
    selectedId: latest.id,
    projectFrom: { ...latest, z: zFromValue("weight", "girl", latest.ageDays, latest.value) },
  },
};

/** Moving over the plot shows the age, value and percentile under the pointer, and the lines either side. */
export const HoverReadout: Story = {
  play: async ({ args, canvasElement, step }) => {
    await measured(canvasElement);
    const canvas = within(canvasElement);

    await step("Hovering shows the readout", async () => {
      await fireEvent.pointerMove(plot(canvasElement), at(plot(canvasElement), 0.3, 0.6));
      await expect(await canvas.findByText(/percentile$/)).toBeInTheDocument();
      await expect(args.onHoverAge).toHaveBeenLastCalledWith(expect.any(Number));
    });

    await step("Leaving hides it", async () => {
      // React turns pointerout into its onPointerLeave; a bare pointerleave event never reaches it.
      await fireEvent.pointerOut(plot(canvasElement), { relatedTarget: canvasElement });
      await expect(canvas.queryByText(/percentile$/)).not.toBeInTheDocument();
      await expect(args.onHoverAge).toHaveBeenLastCalledWith(null);
    });

    // End with the readout showing, so the snapshot includes it.
    await fireEvent.pointerMove(plot(canvasElement), at(plot(canvasElement), 0.7, 0.35));
    await canvas.findByText(/percentile$/);
  },
};

/** Pressing pins a point under the pointer; dragging moves it. */
export const PressAndDragPinsAPoint: Story = {
  play: async ({ args, canvasElement }) => {
    await measured(canvasElement);
    const el = plot(canvasElement);

    await fireEvent.pointerDown(el, at(el, 0.5, 0.5));
    await expect(args.onProbe).toHaveBeenCalledTimes(1);
    const first = (args.onProbe as ReturnType<typeof fn>).mock.calls[0][0];
    await expect(first).toEqual({ ageDays: expect.any(Number), value: expect.any(Number) });

    await fireEvent.pointerMove(el, at(el, 0.8, 0.2));
    await expect(args.onProbe).toHaveBeenCalledTimes(2);
    const second = (args.onProbe as ReturnType<typeof fn>).mock.calls[1][0];
    await expect(second.ageDays).toBeGreaterThan(first.ageDays);
    await expect(second.value).toBeGreaterThan(first.value);

    // Once released, moving only reads out the point again.
    await fireEvent.pointerUp(el, at(el, 0.8, 0.2));
    await fireEvent.pointerMove(el, at(el, 0.6, 0.4));
    await expect(args.onProbe).toHaveBeenCalledTimes(2);
  },
};

/** Pressing on a saved measurement selects it instead of pinning a new point. */
export const PressSelectsAMeasurement: Story = {
  args: { explore: null, babyPoints: mayaWeights },
  play: async ({ args, canvasElement }) => {
    await measured(canvasElement);
    const dots = canvasElement.querySelectorAll('circle[fill="var(--accent)"]');
    await expect(dots).toHaveLength(mayaWeights.length);

    // The dots are drawn in age order, so the third is the 63-day checkup.
    await fireEvent.pointerDown(plot(canvasElement), at(dots[2], 0.5, 0.5));
    await expect(args.onSelectBaby).toHaveBeenCalledWith("m3");
    await expect(args.onProbe).not.toHaveBeenCalled();
  },
};
