import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { ThemeChoice } from "../theme";
import { PICTURES, STATS } from "../verify-ui-tooling";
import { Seal } from "./design-tooling-seal";

/** A picture of the review app with its caption and a link to its full size. */
export function Figure({
  src,
  width,
  height,
  alt,
  children,
}: {
  src: string;
  width: number;
  height: number;
  alt: string;
  children: ReactNode;
}) {
  const href = `${PICTURES}/${src}`;
  return (
    <figure className="tooling-figure">
      <a href={href} target="_blank" rel="noreferrer">
        <img src={href} width={width} height={height} alt={alt} loading="lazy" decoding="async" />
      </a>
      <figcaption>
        {children}
        <a className="tooling-open" href={href} target="_blank" rel="noreferrer">
          Open at full size
          <ExternalLink aria-hidden="true" />
        </a>
      </figcaption>
    </figure>
  );
}

/** The page’s bar: the wordmark as the review app writes it, the way back, and the appearance. */
export function Bar({ theme }: { theme: ThemeChoice }) {
  const flip = () => {
    const now = document.documentElement.dataset.theme; // → "light" | "dark" | undefined
    theme.choose(now === "dark" ? "light" : "dark");
  };
  return (
    <div className="topbar">
      <Link to="/" className="brand">
        Yaklabs <span>/ Verify</span>
      </Link>
      <div className="tooling-bar-actions">
        <button type="button" className="btn btn-sm" onClick={flip}>
          Switch appearance
        </button>
        <Link to="/" className="btn btn-sm">
          Back to Kay
        </Link>
      </div>
    </div>
  );
}

/** The page’s opening: the claim, the pitch, two ways in, and the seal beside them. */
export function Hero() {
  return (
    <header className="tooling-hero">
      <div>
        <p className="eyebrow">DESIGN ENGINEERING / TOOLING</p>
        <h1>
          UI drift is the default. <span>Evidence is the fix.</span>
        </h1>
        <p className="tooling-lede">
          People and agents edit Kay’s interface in the same afternoon.{" "}
          <span className="whitespace-nowrap">verify-ui-drift</span> captures every visual change,
          compares it with an approved reference, checks tokens and contrast, and keeps the
          evidence. A new baseline needs a person. Nothing passes by looking fine.
        </p>
        <div className="tooling-cta">
          <a className="btn" href="#pixels">
            See the pixels
          </a>
          <a className="btn" href="#run">
            How a run works
          </a>
        </div>
      </div>
      <Seal size={200} />
    </header>
  );
}

/** A run’s shape in numbers, laid out as the review app’s own summary row. */
export function Stats() {
  return (
    <dl className="tooling-stats">
      {STATS.map((stat) => (
        <div key={stat.label}>
          <dt>{stat.label}</dt>
          <dd>
            {stat.value}
            <small>{stat.unit}</small>
          </dd>
        </div>
      ))}
    </dl>
  );
}
