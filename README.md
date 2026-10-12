# Little One Percentile

An interactive baby growth chart. It shows where a weight, length or head
circumference falls on the WHO growth charts, from birth to 24 months.

You do not need any measurements to use it:

- **Point at the chart** to read the age, value and percentile under the pointer.
- **Pick an age and a percentile** to see the value. For example, a girl on the
  25th percentile at 13 weeks weighs 11 lb 13 oz.
- **Tap the chart to pin a point**, then drag it. This works when you only roughly
  know your baby's weight.

When you do have measurements, add them. The app then shows your baby's
percentile, how far they are from the median and the nearest percentile lines,
and a dashed line showing where they would be if they stayed on the same
percentile.

Measurements are saved in the browser's localStorage. Nothing is sent to a server.
The chart settings (sex, measure, age, percentile, units) go in the URL, so a
view can be shared as a link, for example
`/?sex=girl&measure=weight&age=13w&p=25`.

## Data and math

The numbers come from the [WHO Child Growth Standards](https://www.who.int/tools/child-growth-standards).
The CDC and the American Academy of Pediatrics recommend these charts for
children under 2 in the US.

WHO publishes each chart as three numbers per day of age, called L, M and S.
The raw tables are in `data/who/` and come from WHO's own
[anthro](https://github.com/WorldHealthOrganization/anthro) package.
`npm run data` converts them into `src/lib/who-data.json` (birth to 730 days,
about 24 KB compressed).

`src/lib/growth.ts` turns a measurement into a z-score and percentile, and back.
For weight beyond 3 standard deviations it applies WHO's straight-line
extension of the curve, as the WHO software does. `npm test` checks the results
against values from the published WHO tables.

## Development

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build. The whole site is static. |
| `npm test` | Tests for the growth math and formatting |
| `npm run lint` | ESLint |
| `npm run data` | Rebuilds `src/lib/who-data.json` from `data/who/` |

Main files:

- `src/components/App.tsx`: page state, URL and storage
- `src/components/GrowthChart.tsx`: the SVG chart and its pointer handling
- `src/components/InsightPanel.tsx`: the sentence above the chart and the facts below it
- `src/components/ExplorePanel.tsx`: the age slider, percentile buttons and values table
- `src/components/BabyPanel.tsx`: saved measurements
- `src/lib/`: data, math, formatting

## Deploying

The site builds to static pages, so any static host works. On Vercel:

```bash
npx vercel deploy --prod
```

Or push the repository to GitHub and import it at vercel.com/new. No
environment variables or database are needed.

## Limits

- Birth to 24 months only. WHO's charts continue to 5 years, but length
  becomes standing height at 2 years, which would need its own handling.
- No corrected age for babies born early.
- Not medical advice. The page says so in its footer.
