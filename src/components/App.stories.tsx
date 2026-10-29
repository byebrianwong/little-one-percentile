import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, spyOn, waitFor, within } from "storybook/test";
import App from "./App";
import { DEFAULT_PREFS, MAYA, PHONE, readStorage, seedStorage } from "@/stories/fixtures";

/** The whole interactive chart: the controls, baby panel, chart, explore panel and table, wired together. */
const meta = {
  title: "App/App",
  component: App,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-6xl">
        <Story />
      </div>
    ),
  ],
  beforeEach() {
    // App copies the chart settings into the page URL. In Storybook that URL belongs to the preview
    // frame, so the write is recorded instead of made.
    spyOn(history, "replaceState").mockImplementation(() => {});
    // fireEvent's synthetic pointer events cannot be captured by the browser (see GrowthChart.stories).
    spyOn(Element.prototype, "setPointerCapture").mockImplementation(() => {});
    spyOn(Element.prototype, "releasePointerCapture").mockImplementation(() => {});
    return seedStorage();
  },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The sentence above the chart. */
const headline = (canvas: HTMLElement) => canvas.querySelector<HTMLElement>('[aria-live="polite"]')!;

const group = (canvas: HTMLElement, name: string) => within(within(canvas).getByRole("radiogroup", { name }));

/** Waits until the chart has measured itself, then returns its plot area. */
async function plot(canvas: HTMLElement) {
  await waitFor(() => expect(canvas.querySelector('section[aria-label="Growth chart"] svg')).toHaveAttribute("height"));
  return canvas.querySelector<SVGRectElement>('rect[fill="transparent"]')!;
}

function at(el: Element, fx: number, fy: number) {
  const r = el.getBoundingClientRect();
  return { clientX: r.left + fx * r.width, clientY: r.top + fy * r.height };
}

/** A first visit: exploring the girls' weight chart at 13 weeks. */
export const FirstVisit: Story = {
  play: async ({ canvasElement, canvas }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent("At 13 weeks, a girl on the 50th percentile weighs 12 lb 14 oz."));
    await expect(canvas.getByText("Exploring")).toBeInTheDocument();
  },
};

/** A saved baby opens on the baby's latest checkup. */
export const ReturningWithABaby: Story = {
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent("At 4 months, Maya weighs 14 lb 5 oz (54th percentile)."));
    await expect(group(canvasElement, "View").getByRole("radio", { name: "Maya" })).toHaveAttribute("aria-checked", "true");
  },
};

/** The controls change every part at once, and the settings are saved and written to the URL. */
export const ChangeSexMeasureAndUnits: Story = {
  play: async ({ canvasElement, userEvent }) => {
    await userEvent.click(group(canvasElement, "Sex").getByRole("radio", { name: "Boy" }));
    await userEvent.click(group(canvasElement, "Measure").getByRole("radio", { name: "Length" }));
    await userEvent.click(group(canvasElement, "Units").getByRole("radio", { name: /kg/ }));

    await expect(headline(canvasElement)).toHaveTextContent("At 13 weeks, a boy on the 50th percentile is 61.4 cm long.");
    await expect(within(canvasElement).getByText("Boys at 13 weeks")).toBeInTheDocument();
    await waitFor(() =>
      expect(history.replaceState).toHaveBeenLastCalledWith(null, "", expect.stringMatching(/\?sex=boy&measure=length&age=13w&p=50&units=metric$/)),
    );
    await expect(readStorage().prefs).toEqual({ sex: "boy", metric: "length", units: "metric" });
  },
};

/** A link with settings in it opens on those settings. */
export const OpenASharedLink: Story = {
  beforeEach() {
    // Adds the settings to the preview frame's URL with the real replaceState, and puts it back afterwards.
    const original = location.href;
    const sep = location.search ? "&" : "?";
    History.prototype.replaceState.call(history, null, "", `${location.pathname}${location.search}${sep}sex=boy&measure=head&age=26w&p=90`);
    return () => History.prototype.replaceState.call(history, null, "", original);
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/^At 6 months, a boy on the 90th percentile has a [\d.]+ in head\.$/));
    await expect(group(canvasElement, "Measure").getByRole("radio", { name: "Head" })).toHaveAttribute("aria-checked", "true");
  },
};

/** Pinning a point on the chart, then saving it as the baby's first measurement. */
export const PinAPointAndSaveIt: Story = {
  play: async ({ canvasElement, canvas, userEvent }) => {
    const el = await plot(canvasElement);
    await fireEvent.pointerDown(el, at(el, 0.6, 0.4));
    await fireEvent.pointerUp(el, at(el, 0.6, 0.4));

    await expect(await canvas.findByText("Pinned point")).toBeInTheDocument();
    await expect(headline(canvasElement)).toHaveTextContent(/percentile for girls\.$/);

    await userEvent.click(canvas.getByRole("button", { name: "Save as my baby’s measurement" }));
    await expect(group(canvasElement, "View").getByRole("radio", { name: "My baby" })).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getAllByRole("listitem")).toHaveLength(1);
    await waitFor(() => expect(readStorage().baby?.measurements).toHaveLength(1));
    await expect(readStorage().baby?.sex).toBe("girl");
  },
};

/** With a birthday, a saved point also gets the date it stands for. */
export const SaveAPointForABabyWithABirthday: Story = {
  beforeEach: () => seedStorage(DEFAULT_PREFS, { name: "", sex: "girl", birthDate: MAYA.birthDate, measurements: [] }),
  play: async ({ canvasElement, canvas, userEvent }) => {
    const el = await plot(canvasElement);
    await fireEvent.pointerDown(el, at(el, 0.5, 0.5));
    await fireEvent.pointerUp(el, at(el, 0.5, 0.5));
    await userEvent.click(await canvas.findByRole("button", { name: "Save as my baby’s measurement" }));
    await waitFor(() => expect(readStorage().baby?.measurements[0].date).toMatch(/^2026-\d\d-\d\d$/));
  },
};

/** The Clear button and the Escape key both unpin the point. */
export const UnpinThePoint: Story = {
  play: async ({ canvasElement, canvas, userEvent }) => {
    const el = await plot(canvasElement);
    await fireEvent.pointerDown(el, at(el, 0.4, 0.5));
    await fireEvent.pointerUp(el, at(el, 0.4, 0.5));
    await userEvent.click(await canvas.findByRole("button", { name: "Clear the pinned point" }));
    await expect(canvas.getByText("Exploring")).toBeInTheDocument();

    await fireEvent.pointerDown(el, at(el, 0.4, 0.5));
    await fireEvent.pointerUp(el, at(el, 0.4, 0.5));
    await expect(await canvas.findByRole("button", { name: "Clear the pinned point" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(canvas.getByText("Exploring")).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Clear the pinned point" })).not.toBeInTheDocument();
  },
};

/** The side panel's controls explore from the current point. An age past the chart's edge widens the chart. */
export const ExploreFromTheSidePanel: Story = {
  play: async ({ canvasElement, canvas, userEvent }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/^At 13 weeks/));
    await userEvent.click(canvas.getByRole("button", { name: "Older" }));
    await expect(headline(canvasElement)).toHaveTextContent(/^At 14 weeks, a girl on the 50th/);
    await userEvent.click(canvas.getByRole("button", { name: "90" }));
    await expect(headline(canvasElement)).toHaveTextContent(/^At 14 weeks, a girl on the 90th/);

    await expect(group(canvasElement, "Age range").getByRole("radio", { name: "6 mo" })).toHaveAttribute("aria-checked", "true");
    // 1 year needs the 2-year chart: each range keeps the age in focus within 85% of its width.
    await userEvent.click(canvas.getByRole("button", { name: "1 yr" }));
    await expect(group(canvasElement, "Age range").getByRole("radio", { name: "2 yr" })).toHaveAttribute("aria-checked", "true");
  },
};

/** The View switch moves between the baby's latest checkup and exploring. */
export const SwitchBetweenTheBabyAndExploring: Story = {
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvasElement, userEvent }) => {
    // The View switch only appears once App has loaded the saved baby.
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/Maya weighs/));
    const view = group(canvasElement, "View");
    await userEvent.click(view.getByRole("radio", { name: "Explore" }));
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/^At 4 months, a girl on the 50th percentile weighs/));
    await userEvent.click(view.getByRole("radio", { name: "Maya" }));
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/Maya weighs/));
  },
};

/** Picking a checkup that has no length switches the chart to a measure it does have. */
export const SelectACheckupInThePanel: Story = {
  beforeEach: () => seedStorage({ ...DEFAULT_PREFS, metric: "length" }, MAYA),
  play: async ({ canvasElement, canvas, userEvent }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/^At 14 weeks, Maya is [\d.]+ in long/));
    await userEvent.click(within(canvas.getByRole("region", { name: "Your baby" })).getByText("4 weeks"));
    await expect(headline(canvasElement)).toHaveTextContent("At 4 weeks, Maya weighs 9 lb 8 oz (59th percentile).");
    await expect(group(canvasElement, "Measure").getByRole("radio", { name: "Weight" })).toHaveAttribute("aria-checked", "true");
  },
};

/** Pressing one of the baby's dots on the chart selects that checkup. */
export const SelectACheckupOnTheChart: Story = {
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvasElement }) => {
    const el = await plot(canvasElement);
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/Maya weighs/));
    // The unselected dots, in age order: birth, 4 weeks, 9 weeks, 14 weeks. The latest checkup is selected.
    const dots = canvasElement.querySelectorAll('circle[fill="var(--accent)"][r="5"]');
    await fireEvent.pointerDown(el, at(dots[2], 0.5, 0.5));
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent("At 9 weeks, Maya weighs 11 lb 11 oz (57th percentile)."));
  },
};

/** A new checkup is shown on the chart straight away. */
export const AddACheckup: Story = {
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole("button", { name: "+ Add a measurement" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Pounds" }), "15");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(headline(canvasElement)).toHaveTextContent(/^At 4 months, Maya weighs 15 lb \(\d+\w\w percentile\)\.$/);
  },
};

/** Entering a birthday moves the chart to the baby's age today. */
export const ABirthdayMovesTheChart: Story = {
  play: async ({ canvasElement, canvas }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/^At 13 weeks/));
    await fireEvent.change(canvas.getByLabelText("Birthday (optional)"), { target: { value: "2025-12-15" } });
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent(/^At 6 months, a girl on the 50th percentile/));
    await expect(group(canvasElement, "Age range").getByRole("radio", { name: "1 yr" })).toHaveAttribute("aria-checked", "true");
  },
};

/** Resetting the baby goes back to exploring. */
export const ResetTheBaby: Story = {
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvasElement, canvas, userEvent }) => {
    spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(await canvas.findByRole("button", { name: "Reset" }));
    await expect(canvas.queryByRole("radiogroup", { name: "View" })).not.toBeInTheDocument();
    await expect(headline(canvasElement)).toHaveTextContent(/a girl on the 50th percentile/);
    await waitFor(() => expect(readStorage().baby).toBeNull());
  },
};

/** Clicking a value in the table shows it on the chart. */
export const PickFromTheTable: Story = {
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Full table: girls' weight by age"));
    const row = canvas.getByRole("row", { name: /^6 months/ });
    await userEvent.click(within(row).getAllByRole("button")[5]);
    await expect(headline(canvasElement)).toHaveTextContent(/^At 6 months, a girl on the 90th percentile weighs/);
  },
};

/** A girl's measurements are not drawn on the boys' chart; the baby panel offers to switch. */
export const BabyOnTheOtherChart: Story = {
  beforeEach: () => seedStorage({ ...DEFAULT_PREFS, sex: "boy" }, MAYA),
  play: async ({ canvasElement, canvas, userEvent }) => {
    // Wait for App to load the saved baby; until then there is no View switch for any reason.
    const show = await canvas.findByRole("button", { name: "Show girls' chart" });
    await expect(canvas.queryByRole("radiogroup", { name: "View" })).not.toBeInTheDocument();
    await userEvent.click(show);
    await expect(group(canvasElement, "Sex").getByRole("radio", { name: "Girl" })).toHaveAttribute("aria-checked", "true");
    await expect(canvas.getByRole("radiogroup", { name: "View" })).toBeInTheDocument();
  },
};

/** On a phone the age and percentile controls move under the chart. */
export const OnAPhone: Story = {
  ...PHONE,
  play: async ({ canvasElement, canvas, userEvent }) => {
    await expect(await canvas.findByText("Tap the chart to pin a point, then drag it.")).toBeVisible();
    // Both copies of the controls are in the page; on a phone only the one under the chart shows.
    const older = canvas.getAllByRole("button", { name: "Older" }).find((b) => b.checkVisibility())!;
    await userEvent.click(older);
    await expect(headline(canvasElement)).toHaveTextContent(/^At 14 weeks, a girl on the 50th/);
    await userEvent.click(canvas.getAllByRole("button", { name: "75" }).find((b) => b.checkVisibility())!);
    await expect(headline(canvasElement)).toHaveTextContent(/^At 14 weeks, a girl on the 75th/);
  },
};

export const ReturningWithABabyOnAPhone: Story = {
  ...PHONE,
  beforeEach: () => seedStorage(DEFAULT_PREFS, MAYA),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(headline(canvasElement)).toHaveTextContent("Maya weighs"));
  },
};
