import App from "@/components/App";

export default function Home() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-2)]">
          <Logo />
          Little One Percentile
        </div>
        <h1 className="font-display max-w-3xl text-[1.6rem] leading-tight text-[var(--ink)] sm:text-4xl">
          Where does your baby sit on the growth chart?
        </h1>
        <p className="max-w-2xl text-sm text-[var(--ink-2)] sm:text-base">
          Point anywhere on the chart, or pick an age and percentile. No measurements needed. Add your baby&rsquo;s
          numbers when you have them.
        </p>
      </header>

      <App />

      <section className="grid gap-6 text-sm leading-relaxed text-[var(--ink-2)] md:grid-cols-3">
        <div>
          <h2 className="mb-1.5 font-semibold text-[var(--ink)]">What a percentile means</h2>
          <p>
            A baby on the 25th percentile for weight weighs more than 25 out of 100 healthy babies of the same age and
            sex, and less than the other 75. The 50th percentile is the median: half of babies are above it and half
            below. A low or high percentile is not good or bad by itself.
          </p>
        </div>
        <div>
          <h2 className="mb-1.5 font-semibold text-[var(--ink)]">What the dashed line means</h2>
          <p>
            The dashed line shows where your baby would be if they stayed on the same percentile. It is not a
            prediction. Many babies move across percentile lines in the first months, especially between birth and 6
            months. Doctors look at the pattern over several visits rather than one number.
          </p>
        </div>
        <div>
          <h2 className="mb-1.5 font-semibold text-[var(--ink)]">Where the numbers come from</h2>
          <p>
            The{" "}
            <a className="underline decoration-[var(--axis)] underline-offset-2 hover:text-[var(--ink)]" href="https://www.who.int/tools/child-growth-standards">
              WHO Child Growth Standards
            </a>
            , calculated day by day from birth to 24 months. The CDC and the American Academy of Pediatrics recommend
            these charts for children under 2 in the US. Percentiles are computed exactly from the WHO&rsquo;s published
            formulas, not read off a picture of a chart.
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] pt-5 pb-8 text-xs leading-relaxed text-[var(--ink-3)]">
        This site is for general information and is not medical advice. If you are worried about your baby&rsquo;s
        growth, talk to your pediatrician or health visitor. Measurements you enter stay in your browser and are never
        sent anywhere.
      </footer>
    </div>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="7" fill="var(--band-2)" />
      <path d="M4 18 C 9 16, 13 11, 20 7" stroke="var(--median)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="14" cy="11.3" r="2.6" fill="var(--accent)" stroke="var(--surface)" strokeWidth="1.4" />
    </svg>
  );
}
