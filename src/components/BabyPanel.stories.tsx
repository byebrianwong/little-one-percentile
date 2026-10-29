import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fireEvent, fn, spyOn } from "storybook/test";
import BabyPanel from "./BabyPanel";
import { BY_AGE, MAYA, TODAY } from "@/stories/fixtures";

const meta = {
  title: "Baby/BabyPanel",
  component: BabyPanel,
  decorators: [
    (Story) => (
      <div className="max-w-[340px]">
        <Story />
      </div>
    ),
  ],
  args: {
    baby: null,
    sex: "girl",
    metric: "weight",
    units: "imperial",
    onChange: fn(),
    onSelect: fn(),
    onAdded: fn(),
    onShowChart: fn(),
  },
  // The panel reports every change and App keeps the baby. This keeps it here instead, so typing,
  // adding and deleting work in Storybook too.
  render: function Render(args) {
    const [baby, setBaby] = useState(args.baby);
    return (
      <BabyPanel
        {...args}
        baby={baby}
        onChange={(b) => {
          setBaby(b);
          args.onChange(b);
        }}
      />
    );
  },
} satisfies Meta<typeof BabyPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing saved yet. */
export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Tap the chart where you think your baby is/)).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument();
  },
};

/** A baby with a birthday: the exact age today, and dated checkups, newest first. */
export const WithABirthday: Story = {
  args: { baby: MAYA },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Maya is/)).toHaveTextContent("Maya is 17 weeks, 6 days old today.");
    const items = canvas.getAllByRole("listitem");
    await expect(items).toHaveLength(5);
    await expect(items[0]).toHaveTextContent("4 months2026-06-12");
    await expect(items[4]).toHaveTextContent("Birth2026-02-10");
    await expect(canvas.getByRole("radio", { name: "Girl" })).toHaveAttribute("aria-checked", "true");
  },
};

/** Measurements entered by age, with no birthday or name. */
export const ByAgeOnly: Story = {
  args: { baby: BY_AGE, sex: "boy", metric: "length", units: "metric" },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/old today/)).not.toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(3);
    await expect(canvas.getByText("61.4 cm")).toBeInTheDocument();
  },
};

export const BornToday: Story = {
  args: { baby: { name: "", birthDate: TODAY, measurements: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Your baby was born today.")).toBeInTheDocument();
  },
};

/** When the chart shows the other sex, the panel offers to switch back. */
export const OnTheOtherChart: Story = {
  args: { baby: MAYA, sex: "boy" },
  play: async ({ args, canvas, userEvent }) => {
    await expect(canvas.getByText("Your baby’s measurements are on the girls' chart.")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Show girls' chart" }));
    await expect(args.onShowChart).toHaveBeenCalledWith("girl");
  },
};

export const ChooseTheSex: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("radio", { name: "Boy" }));
    await expect(args.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sex: "boy" }));
    await expect(args.onShowChart).toHaveBeenCalledWith("boy");
    await expect(canvas.getByRole("radio", { name: "Boy" })).toHaveAttribute("aria-checked", "true");
  },
};

export const NameAndBirthday: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Name (optional)" }), "Maya");
    await fireEvent.change(canvas.getByLabelText("Birthday (optional)"), { target: { value: "2026-02-10" } });
    await expect(canvas.getByText(/Maya is/)).toHaveTextContent("Maya is 17 weeks, 6 days old today.");
  },
};

/** A new birthday re-counts the age of every checkup that was entered by date. */
export const ChangingTheBirthdayMovesDatedCheckups: Story = {
  args: { baby: MAYA },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText("14 weeks")).toBeInTheDocument();
    await fireEvent.change(canvas.getByLabelText("Birthday (optional)"), { target: { value: "2026-02-03" } });
    await expect(canvas.getByText("15 weeks")).toBeInTheDocument();
    await expect(canvas.getByText(/Maya is/)).toHaveTextContent("Maya is 18 weeks, 6 days old today.");
    const saved = (args.onChange as ReturnType<typeof fn>).mock.lastCall![0];
    await expect(saved.measurements.find((m: { id: string }) => m.id === "m4").ageDays).toBe(105);
  },
};

/** Without a birthday the form asks for the age; in US units, pounds and ounces. */
export const AddFormByAge: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await expect(canvas.getByRole("textbox", { name: "Age" })).toHaveFocus();
    await expect(canvas.getByRole("textbox", { name: "Pounds" })).toBeInTheDocument();
    await expect(canvas.getByRole("textbox", { name: "Ounces" })).toBeInTheDocument();
  },
};

/** With a birthday the form asks for the date, which starts at today; in metric units, kilograms. */
export const AddFormByDate: Story = {
  args: { baby: MAYA, units: "metric" },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await expect(canvas.getByLabelText("Date measured")).toHaveValue(TODAY);
    await expect(canvas.getByRole("textbox", { name: "Kilograms" })).toBeInTheDocument();
    await expect(canvas.queryByRole("textbox", { name: "Pounds" })).not.toBeInTheDocument();
  },
};

export const AddAMeasurementByAge: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Age" }), "13");
    await userEvent.type(canvas.getByRole("textbox", { name: "Pounds" }), "12");
    await userEvent.type(canvas.getByRole("textbox", { name: "Ounces" }), "4");
    await userEvent.type(canvas.getByRole("textbox", { name: "Length" }), "24");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));

    const added = (args.onAdded as ReturnType<typeof fn>).mock.lastCall![0];
    await expect(added.ageDays).toBe(91);
    await expect(added.weight).toBeCloseTo(12.25 / 2.20462262, 6);
    await expect(added.length).toBeCloseTo(60.96, 6);
    await expect(added.date).toBeUndefined();
    // A baby whose sex was never chosen takes the sex of the chart on screen.
    await expect(args.onChange).toHaveBeenLastCalledWith(expect.objectContaining({ sex: "girl" }));
    await expect(canvas.getByRole("listitem")).toHaveTextContent("13 weeks");
  },
};

export const AddAMeasurementByDate: Story = {
  args: { baby: MAYA, units: "metric" },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Kilograms" }), "6.6");
    await userEvent.type(canvas.getByRole("textbox", { name: "Head circumference" }), "40.8");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onAdded).toHaveBeenCalledWith(expect.objectContaining({ ageDays: 125, date: TODAY, weight: 6.6, head: 40.8 }));
    await expect(canvas.getAllByRole("listitem")).toHaveLength(6);
  },
};

export const CancelAdding: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await expect(canvas.getByRole("button", { name: "+ Add a measurement" })).toBeInTheDocument();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/** Saving an empty form asks for the age first. */
export const MissingTheAge: Story = {
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Enter your baby's age.");
    await expect(args.onAdded).not.toHaveBeenCalled();
  },
};

export const MissingAMeasurement: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Age" }), "13");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("Add at least one measurement.");
  },
};

/** A number far off the chart is most often the wrong units. */
export const FarOutsideTheChart: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Age" }), "13");
    await userEvent.type(canvas.getByRole("textbox", { name: "Pounds" }), "80");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("That weight looks far outside the chart. Check the units (lb).");
  },
};

export const OlderThanTwoYears: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Age" }), "30");
    await userEvent.selectOptions(canvas.getByRole("combobox", { name: "Age unit" }), "months");
    await userEvent.type(canvas.getByRole("textbox", { name: "Pounds" }), "25");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent("These charts cover birth to 2 years.");
  },
};

/**
 * The date field's minimum is the birthday, so the browser itself refuses an earlier date and the
 * form is never submitted. The app's own "That date is before the birthday." message does not show.
 */
export const BeforeTheBirthday: Story = {
  args: { baby: MAYA },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "+ Add a measurement" }));
    await fireEvent.change(canvas.getByLabelText("Date measured"), { target: { value: "2026-01-20" } });
    await userEvent.type(canvas.getByRole("textbox", { name: "Pounds" }), "8");
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(canvas.getByLabelText("Date measured")).toBeInvalid();
    await expect(args.onAdded).not.toHaveBeenCalled();
  },
};

export const SelectACheckup: Story = {
  args: { baby: MAYA },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("14 weeks"));
    await expect(args.onSelect).toHaveBeenCalledWith(MAYA.measurements[3]);
  },
};

export const DeleteACheckup: Story = {
  args: { baby: MAYA },
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Delete the measurement at 14 weeks" }));
    await expect(canvas.queryByText("14 weeks")).not.toBeInTheDocument();
    await expect(canvas.getAllByRole("listitem")).toHaveLength(4);
    const saved = (args.onChange as ReturnType<typeof fn>).mock.lastCall![0];
    await expect(saved.measurements.map((m: { id: string }) => m.id)).toEqual(["m1", "m2", "m3", "m5"]);
  },
};

/** Reset asks first, and only clears the baby if the person agrees. */
export const Reset: Story = {
  args: { baby: MAYA },
  play: async ({ args, canvas, userEvent }) => {
    const confirm = spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await expect(confirm).toHaveBeenCalledWith("Remove your baby's saved measurements from this browser?");
    await expect(args.onChange).not.toHaveBeenCalled();

    await userEvent.click(canvas.getByRole("button", { name: "Reset" }));
    await expect(args.onChange).toHaveBeenCalledWith(null);
    await expect(canvas.queryByRole("listitem")).not.toBeInTheDocument();
  },
};
