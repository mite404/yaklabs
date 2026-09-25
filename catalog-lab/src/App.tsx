import { useState } from "react";
import { CatalogCard } from "./CatalogCard";
import { agentSchema, resolve } from "./catalog";
import { scenarios } from "./fixtures";

type Gap = {
  id: number;
  catalogVersion: "1";
  scenario: string;
  capability: string;
  reason: string;
  fallback: string;
  status: "needs-triage";
  recordedAt: string;
};

/** Product-evaluation workbench, using fixtures rather than pretending to call an LLM. */
export function App() {
  const [selected, setSelected] = useState("trend");
  const [draft, setDraft] = useState("");
  const [custom, setCustom] = useState<unknown>(undefined);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [capability, setCapability] = useState("Forecast with uncertainty");
  const scenario = scenarios[selected];
  const payload = custom === undefined ? scenario.payload : custom;
  const result = resolve(payload);
  function captureGap() {
    if (!capability.trim()) return;
    setGaps([
      ...gaps,
      {
        id: gaps.length + 1,
        catalogVersion: "1",
        scenario: selected,
        capability: capability.trim().slice(0, 160),
        reason:
          result.kind === "rejected" || result.kind === "fallback"
            ? result.reason
            : "Evaluator requested a new capability",
        fallback: result.kind === "fallback" ? "DataTable" : "None",
        status: "needs-triage",
        recordedAt: new Date().toISOString(),
      },
    ]);
  }
  return (
    <div className="app">
      <aside>
        <a className="brand" href="/">
          ▦ <span>Fieldnotes</span>
        </a>
        <p className="workspace">
          CATALOG LAB <span>01</span>
        </p>
        <p className="sidebar-label">EVALUATION SCENARIOS</p>
        <nav aria-label="Evaluation scenarios">
          {Object.entries(scenarios).map(([key, item]) => (
            <button
              key={key}
              aria-current={selected === key ? "page" : undefined}
              onClick={() => {
                setSelected(key);
                setCustom(undefined);
              }}
            >
              {item.label}
              <span>↗</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="legend-dot" /> Client-owned by design
          <p>
            One approved component.
            <br />
            Validated data. No generated UI code.
          </p>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Experiments <span className="muted">/</span>{" "}
            <b>Catalog-first answers</b>
          </span>
          <span className="badge neutral">Prototype · synthetic data</span>
        </header>
        <section className="intro">
          <p className="eyebrow">A SMALL CATALOG. A CLEAR CONTRACT.</p>
          <h1>
            Useful answers.
            <br />
            <span>Familiar building blocks.</span>
          </h1>
          <p>
            Explore how a trusted component turns a business question into a
            view you can inspect.
          </p>
        </section>
        <div className="question">
          <span className="avatar">Q</span>
          <div>
            <small>THE QUESTION</small>
            <p>{scenario.question}</p>
          </div>
          <span className="badge neutral">Fixture, not live AI</span>
        </div>
        <div className="evaluation">
          <div>
            <CatalogCard key={`${selected}-${draft}`} payload={payload} />
            <details className="contract">
              <summary>Inspect the selection contract</summary>
              <pre>{JSON.stringify(payload, null, 2)}</pre>
              <label htmlFor="payload">Try a JSON selection (max 32 KB)</label>
              <textarea
                id="payload"
                value={draft}
                maxLength={32768}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Paste an agent response"
              />
              <button
                onClick={() => {
                  try {
                    setCustom(JSON.parse(draft));
                  } catch {
                    setCustom(null);
                  }
                }}
              >
                Validate and preview
              </button>
              <details>
                <summary>Model-facing JSON Schema</summary>
                <pre>{JSON.stringify(agentSchema, null, 2)}</pre>
              </details>
            </details>
          </div>
          <section className="evaluation-notes">
            <p className="eyebrow">REVIEW THE FIT</p>
            <h3>What makes this useful?</h3>
            <p>
              The view answers one question. Exact values remain one click away.
            </p>
            <ul>
              <li>Names and units are visible</li>
              <li>Missing data stays missing</li>
              <li>Styling belongs to the product</li>
            </ul>
            <hr />
            <small>APPROVED IN CATALOG V1</small>
            <p className="catalog-entry">
              01 <b>LineChart</b>
              <span>Trend · Snapshot</span>
            </p>
            <p className="catalog-entry">
              02 <b>BarChart</b>
              <span>Comparison</span>
            </p>
            <p className="catalog-entry">
              03 <b>DataTable</b>
              <span>Audit</span>
            </p>
          </section>
        </div>
        <section className="backlog">
          <div>
            <p className="eyebrow">CATALOG EVOLUTION</p>
            <h2>Missing a useful view?</h2>
            <p>
              Record a capability, not confidential business data. Nothing is
              sent to a server.
            </p>
          </div>
          <div>
            <label htmlFor="capability">Capability to explore</label>
            <input
              id="capability"
              maxLength={160}
              value={capability}
              onChange={(event) => setCapability(event.target.value)}
            />
            <button className="primary" onClick={captureGap}>
              Capture catalog gap
            </button>
            <p role="status" className="muted">
              {gaps.length} captured this session · resets on reload
            </p>
          </div>
          {gaps.length > 0 && (
            <details open>
              <summary>Review backlog records</summary>
              <pre>{JSON.stringify(gaps, null, 2)}</pre>
              <a
                download="catalog-gaps.json"
                href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(gaps, null, 2))}`}
              >
                Download JSON
              </a>
            </details>
          )}
        </section>
        <p className="endnote">
          The model selects. The catalog constrains. The product renders.
        </p>
      </main>
    </div>
  );
}
