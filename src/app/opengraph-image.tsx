import { ImageResponse } from "next/og";
import { valueAtPercentile } from "@/lib/growth";

export const alt = "Little One Percentile: an interactive baby growth chart";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Draws the real girls' weight curves, birth to 12 months, as the share image.
export default function Image() {
  const W = 620;
  const H = 420;
  const maxAge = 365;
  const lo = 2;
  const hi = 11.5;
  const pt = (age: number, p: number) => {
    const x = (age / maxAge) * W;
    const y = H - ((valueAtPercentile("weight", "girl", age, p) - lo) / (hi - lo)) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const ages = Array.from({ length: 61 }, (_, i) => (i / 60) * maxAge);
  const line = (p: number) => "M" + ages.map((a) => pt(a, p)).join(" L");
  const band = (a: number, b: number) =>
    "M" + ages.map((x) => pt(x, b)).join(" L") + " L" + [...ages].reverse().map((x) => pt(x, a)).join(" L") + " Z";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f7f4ee", padding: 64, fontFamily: "serif" }}>
        <div style={{ display: "flex", flexDirection: "column", width: 440, justifyContent: "center" }}>
          <div style={{ fontSize: 26, color: "#55524c", fontFamily: "sans-serif", marginBottom: 24 }}>Little One Percentile</div>
          <div style={{ fontSize: 60, lineHeight: 1.1, color: "#1d1b18" }}>Where does your baby sit on the growth chart?</div>
          <div style={{ fontSize: 26, color: "#55524c", fontFamily: "sans-serif", marginTop: 28 }}>
            Any age, any percentile. No measurements needed.
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            <path d={band(3, 97)} fill="#e3eefc" />
            <path d={band(10, 90)} fill="#cde2fb" />
            <path d={band(25, 75)} fill="#b7d3f6" />
            <path d={line(50)} stroke="#1c5cab" strokeWidth={5} fill="none" />
            <path d={"M" + ages.filter((a) => a >= 120).map((a) => pt(a, 30)).join(" L")} stroke="#eb6834" strokeWidth={4} strokeDasharray="10 10" fill="none" />
            <circle cx={(120 / maxAge) * W} cy={Number(pt(120, 30).split(",")[1])} r={13} fill="#eb6834" stroke="#fff" strokeWidth={5} />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
