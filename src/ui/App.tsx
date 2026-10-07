import { useMemo, useRef, useState } from 'react';
import { runChecks } from '../engine/checks';
import { decisionMemo, scenarioCsv } from '../engine/exports';
import { SAMPLES } from '../engine/samples';
import { DEFAULT_ASSUMPTIONS, lagSensitivity, round, runAll } from '../engine/scenarios';
import type { Assumptions, Resolutions, ScenarioId } from '../engine/types';
import { parseDataset } from '../engine/validate';
import { Chart } from './Chart';
import { download, gbp, mwh, signedGbp } from './download';
import { FIXTURE_TEXT } from './fixtures';

const START = SAMPLES[0].file;
const STATUS_TEXT = { ready: 'Ready', review: 'Needs review', blocked: 'Blocked', ok: 'Covered', gap: 'Missing', excluded: 'Excluded' } as const;

function Chip({ s }: { s: keyof typeof STATUS_TEXT }) {
  return <span className={`chip chip-${s}`}>{STATUS_TEXT[s]}</span>;
}

type NumKey = { [K in keyof Assumptions]: Assumptions[K] extends number ? K : never }[keyof Assumptions];

export function App() {
  const [source, setSource] = useState({ name: START, text: FIXTURE_TEXT[START] });
  const [res, setRes] = useState<Resolutions>({});
  const [a, setA] = useState<Assumptions>(DEFAULT_ASSUMPTIONS);
  const [scenario, setScenario] = useState<ScenarioId>('baseline');
  const [sel, setSel] = useState<number | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const ds = useMemo(() => parseDataset(source.name, source.text), [source]);
  const checks = useMemo(() => runChecks(ds, res, a.staleHours), [ds, res, a.staleHours]);
  const results = useMemo(() => runAll(ds, checks, a), [ds, checks, a]);
  const lag = useMemo(() => lagSensitivity(ds, checks, a), [ds, checks, a]);
  const current = results.find((r) => r.id === scenario)!;
  const base = results[0];
  const generators = ds.assets.filter((x) => x.type === 'generation');
  const selPeriod = sel !== null ? current.periods.find((p) => p.sp === sel) ?? null : null;
  const rowsById = useMemo(() => new Map(ds.rows.map((r) => [r.rowId, r])), [ds]);

  function load(name: string, text: string) {
    setSource({ name, text });
    setRes({});
    setSel(null);
    setUploadError(null);
    const parsed = parseDataset(name, text);
    const gens = parsed.assets.filter((x) => x.type === 'generation');
    setA((prev) => (gens.length && !gens.some((g) => g.id === prev.outageAsset) ? { ...prev, outageAsset: gens[gens.length - 1].id } : prev));
  }
  function resetAll() {
    load(START, FIXTURE_TEXT[START]);
    setA(DEFAULT_ASSUMPTIONS);
    setScenario('baseline');
    setReviewer('');
    setNote('');
    if (fileRef.current) fileRef.current.value = '';
  }
  async function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2_000_000) { setUploadError('File is over 2 MB; this prototype reads one settlement day at a time.'); return; }
    load(f.name, await f.text());
  }
  const setNum = (k: NumKey, v: string) => {
    const n = Number(v);
    if (v !== '' && Number.isFinite(n)) setA((p) => ({ ...p, [k]: n }));
  };
  const memo = () =>
    decisionMemo({ ds, checks, results, assumptions: a, resolutions: res, lag, reviewer, note, generatedAt: new Date().toISOString() });
  const stem = `${ds.date ?? 'unknown'}-${ds.fingerprint}`;

  // Prioritisation signals, all derived from the current synthetic run.
  const lagPoints = lag.filter((p) => p.costGbp !== null);
  const perLagSp = lagPoints.length > 1 ? round((lagPoints[lagPoints.length - 1].costGbp! - lagPoints[0].costGbp!) / (lagPoints[lagPoints.length - 1].lag - lagPoints[0].lag), 2) : null;
  const spikeDelta = results[1].totals && base.totals ? round(results[1].totals.costGbp - base.totals.costGbp, 2) : null;
  const outageDelta = results[2].totals && base.totals ? round(results[2].totals.costGbp - base.totals.costGbp, 2) : null;
  const blockedPeriods = base.periods.filter((p) => p.status === 'blocked').length;

  const num = (k: NumKey, label: string, unit: string, min = 0, max?: number, step = 1) => (
    <label className="field">
      <span>{label}</span>
      <span className="input-unit">
        <input type="number" inputMode="decimal" min={min} max={max} step={step} value={a[k]} onChange={(e) => setNum(k, e.target.value)} />
        <em>{unit}</em>
      </span>
    </label>
  );

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="nav">
        <img src="./tem-logo.svg" alt="tem" width={76} height={20} />
        <span className="nav-title">Rosso Scenario Desk</span>
        <span className="nav-label">Independent concept by Ayo Ahmed. Not affiliated with tem.</span>
        <button type="button" className="btn-ghost" onClick={resetAll}>Reset</button>
      </header>

      <main id="main">
        <section className="intro">
          <h1>What would this day have cost if the forecast missed?</h1>
          <p>
            Load one synthetic settlement day, check whether the data can support a conclusion, then compare a baseline with a demand spike and a generator
            outage. Every number is fictional, every chart bar traces to its source rows, and missing data blocks the answer instead of becoming zero.
          </p>
          <p className="simulated" role="note">
            <strong>Simulated.</strong> Fictional assets, readings and prices. A deliberately simple model, not tem&rsquo;s or Rosso&rsquo;s. No live prices, no trades,
            no automated decisions.
          </p>
        </section>

        <section className="card step" aria-labelledby="s1">
          <h2 id="s1"><span className="num">1</span> Load a day</h2>
          <div className="samples" role="group" aria-label="Seeded examples">
            {SAMPLES.map((s) => (
              <button key={s.file} type="button" className={`sample ${source.name === s.file ? 'active' : ''}`} aria-pressed={source.name === s.file} onClick={() => load(s.file, FIXTURE_TEXT[s.file])}>
                <strong>{s.title}</strong>
                <span>{s.expect}</span>
              </button>
            ))}
          </div>
          <div className="upload">
            <label className="field">
              <span>Or upload a CSV in the same format</span>
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <a className="link" href={`./samples/${SAMPLES[0].file}`} download>Download sample CSV</a>
          </div>
          {uploadError && <p className="err" role="alert">{uploadError}</p>}
          <dl className="facts mono">
            <div><dt>File</dt><dd>{ds.name}</dd></div>
            <div><dt>Fingerprint</dt><dd>{ds.fingerprint}</dd></div>
            <div><dt>Settlement date</dt><dd>{ds.date ?? 'n/a'}</dd></div>
            <div><dt>Periods expected</dt><dd>{ds.expectedSps}{ds.expectedSps !== 48 ? ' (clock change)' : ''}</dd></div>
            <div><dt>Rows accepted</dt><dd>{ds.rows.length}</dd></div>
            <div><dt>Assets</dt><dd>{ds.assets.map((x) => `${x.id} ${x.type === 'demand' ? 'dem' : 'gen'}`).join(', ') || 'none'}</dd></div>
          </dl>
        </section>

        <section className="card step" aria-labelledby="s2">
          <h2 id="s2"><span className="num">2</span> Checks</h2>
          <div className="checks-grid">
            <div className="panel">
              <h3>Data coverage</h3>
              <p className="big mono">{checks.coverage.covered}<small> / {checks.coverage.expected} slots</small></p>
              <p className="muted">Is there a reading for every asset in every period? This is about the data, not the model.</p>
              {checks.coverage.gaps.length > 0 ? (
                <ul className="issue-list" aria-label="Missing readings">
                  {checks.coverage.gaps.map((g) => (
                    <li key={`${g.assetId}-${g.sp}`}><Chip s="gap" /> <span className="mono">{g.assetId} SP {g.sp}</span> {g.reason}</li>
                  ))}
                </ul>
              ) : (
                <p><Chip s="ok" /> No missing readings.</p>
              )}
            </div>
            <div className="panel">
              <h3>Forecast error, by model version</h3>
              <p className="muted">How wrong was the forecast where we do have data? Versions are never pooled.</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Type</th><th scope="col">Model</th><th scope="col">Used</th><th scope="col">MAE</th><th scope="col">Bias</th></tr></thead>
                  <tbody>
                    {checks.errorStats.map((s) => (
                      <tr key={s.assetType + s.model}>
                        <td>{s.assetType}</td><td className="mono">{s.model}</td><td className="mono">{s.n}/{s.expected}</td>
                        <td className="mono">{mwh(s.maeMwh, 3)}</td><td className="mono">{mwh(s.biasMwh, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {ds.issues.filter((i) => i.severity !== 'info').length > 0 && (
            <div className="panel">
              <h3>Validation</h3>
              <ul className="issue-list">
                {ds.issues.map((i) => (
                  <li key={i.id}><Chip s="blocked" /> {i.message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="panel" aria-live="polite">
            <h3>Manual review {checks.review.length > 0 && <span className="count">{checks.openReview.length} open</span>}</h3>
            {checks.review.length === 0 && <p><Chip s="ok" /> Nothing stale or conflicting.</p>}
            {checks.review.map((r) => (
              <fieldset key={r.id} className={`review ${res[r.id] ? 'done' : ''}`}>
                <legend>{res[r.id] ? <Chip s="ok" /> : <Chip s="review" />} {r.title}</legend>
                <p className="muted">{r.detail}</p>
                <div className="options">
                  {r.options.map((o) => (
                    <label key={o.value} className="option">
                      <input type="radio" name={r.id} value={o.value} checked={res[r.id] === o.value} onChange={() => setRes((p) => ({ ...p, [r.id]: o.value }))} />
                      <span><strong>{o.label}</strong><small>{o.effect}</small></span>
                    </label>
                  ))}
                </div>
                {res[r.id] && (
                  <button type="button" className="link" onClick={() => setRes((p) => { const n = { ...p }; delete n[r.id]; return n; })}>Undo decision</button>
                )}
              </fieldset>
            ))}
          </div>
        </section>

        <section className="card step" aria-labelledby="s3">
          <h2 id="s3"><span className="num">3</span> Scenarios</h2>
          <div className="scenario-cards" role="tablist" aria-label="Scenario">
            {results.map((r) => (
              <button key={r.id} type="button" role="tab" aria-selected={scenario === r.id} className={`scard ${scenario === r.id ? 'active' : ''}`} onClick={() => setScenario(r.id)}>
                <span className="scard-head"><strong>{r.label}</strong><Chip s={r.status} /></span>
                {r.totals ? (
                  <>
                    <span className="big mono">{gbp(r.totals.costGbp)}</span>
                    <span className="mono small">short {mwh(r.totals.shortMwh)} · long {mwh(r.totals.longMwh)}</span>
                    {r.id !== 'baseline' && base.totals && <span className="delta mono">{signedGbp(round(r.totals.costGbp - base.totals.costGbp, 2))} vs baseline</span>}
                  </>
                ) : (
                  <>
                    <span className="big withheld">Withheld</span>
                    <span className="small">{r.reasons[0]}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {current.status !== 'ready' && (
            <div className={`banner banner-${current.status}`} role="status">
              <strong>{current.status === 'blocked' ? 'No conclusion: data does not support one.' : 'No conclusion yet: waiting for a human decision.'}</strong>
              <ul>{current.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              <p className="small">Covered-only subtotal, for context and not a conclusion: {gbp(current.coveredSubtotal.costGbp)} across {current.okPeriods} of {current.periods.length} periods.</p>
            </div>
          )}

          <div className="chart-block">
            <div className="chart-legend small">
              <span><i className="sw sw-short" /> short (illustrative cost)</span>
              <span><i className="sw sw-long" /> long</span>
              <span><i className="sw sw-review" /> needs review</span>
              <span><i className="sw sw-blocked" /> blocked: no value</span>
            </div>
            <Chart periods={current.periods} selected={sel} onSelect={setSel} />
          </div>

          <div className="trace" aria-live="polite">
            <h3>Trace</h3>
            {!selPeriod && <p className="muted">Select a bar (click, or focus it and press Enter) to see the source rows behind it.</p>}
            {selPeriod && (
              <>
                <p className="trace-head"><span className="mono">{selPeriod.label}</span> <Chip s={selPeriod.status === 'ok' ? 'ready' : selPeriod.status} /> <span className="mono">{current.label}</span></p>
                <dl className="facts mono">
                  <div><dt>Demand actual / forecast</dt><dd>{mwh(selPeriod.demandActual, 3)} / {mwh(selPeriod.demandFcst, 3)}</dd></div>
                  <div><dt>Generation actual / forecast</dt><dd>{mwh(selPeriod.genActual, 3)} / {mwh(selPeriod.genFcst, 3)}</dd></div>
                  <div><dt>Imbalance (actual net - forecast net)</dt><dd>{mwh(selPeriod.imbalanceMwh, 3)}</dd></div>
                  <div><dt>Fictional price</dt><dd>£{selPeriod.refPrice}/MWh</dd></div>
                  <div><dt>Illustrative cost</dt><dd>{selPeriod.costGbp === null ? 'n/a (not computed)' : `£${selPeriod.costGbp.toFixed(2)}`}</dd></div>
                </dl>
                {selPeriod.reasons.length > 0 && <ul className="issue-list">{selPeriod.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}
                {selPeriod.transforms.length > 0 && <ul className="issue-list">{selPeriod.transforms.map((x) => <li key={x}><span className="tag">scenario</span> {x}</li>)}</ul>}
                <div className="table-wrap">
                  <table className="src">
                    <caption className="small">Source rows ({ds.name})</caption>
                    <thead><tr><th scope="col">Line</th><th scope="col">Raw CSV</th></tr></thead>
                    <tbody>
                      {selPeriod.sourceRowIds.map((id) => {
                        const r = rowsById.get(id);
                        return <tr key={id}><td className="mono">{r?.line ?? '?'}</td><td className="mono raw">{r?.raw ?? id}</td></tr>;
                      })}
                      {selPeriod.sourceRowIds.length < ds.assets.length && (
                        <tr><td className="mono">none</td><td className="raw">{ds.assets.length - selPeriod.sourceRowIds.length} asset(s) have no row for this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>

        <div className="two-col">
          <section className="card step" aria-labelledby="s4">
            <h2 id="s4"><span className="num">4</span> Assumptions</h2>
            <p className="muted">All fictional. Change any value and everything recalculates.</p>
            <fieldset className="group"><legend>Demand spike</legend><div className="group-grid">
              {num('spikePct', 'Uplift on all demand', '%', -50, 200)}
              {num('spikeStart', 'From SP', '', 1, ds.expectedSps)}
              {num('spikeEnd', 'To SP', '', 1, ds.expectedSps)}
            </div></fieldset>
            <fieldset className="group"><legend>Generator outage</legend><div className="group-grid">
              <label className="field"><span>Asset</span>
                <select value={a.outageAsset} onChange={(e) => setA((p) => ({ ...p, outageAsset: e.target.value }))}>
                  {generators.map((g) => <option key={g.id} value={g.id}>{g.id}</option>)}
                  {!generators.some((g) => g.id === a.outageAsset) && <option value={a.outageAsset}>{a.outageAsset} (not in file)</option>}
                </select>
              </label>
              {num('outageStart', 'From SP', '', 1, ds.expectedSps)}
              {num('outageEnd', 'To SP', '', 1, ds.expectedSps)}
              {num('detectionLagSps', 'Detection lag', 'SP', 0, 48)}
            </div></fieldset>
            <fieldset className="group"><legend>Fictional prices</legend><div className="group-grid">
              {num('peakPrice', 'Peak', '£/MWh', 0)}
              {num('offPeakPrice', 'Off-peak', '£/MWh', 0)}
              {num('peakStart', 'Peak from SP', '', 1, ds.expectedSps)}
              {num('peakEnd', 'Peak to SP', '', 1, ds.expectedSps)}
              {num('shortPremiumPct', 'Short premium', '%', 0)}
              {num('longDiscountPct', 'Long spill loss', '%', 0, 100)}
            </div></fieldset>
            <fieldset className="group"><legend>Review rules</legend><div className="group-grid">
              {num('staleHours', 'Stale forecast after', 'h', 1)}
            </div></fieldset>
            <button type="button" className="btn-ghost" onClick={() => setA(DEFAULT_ASSUMPTIONS)}>Reset assumptions</button>
            <details className="formula">
              <summary>Formulas</summary>
              <ul className="mono small">
                <li>net = generation - demand</li>
                <li>imbalance = actual net - forecast net (negative = short)</li>
                <li>short cost = |imbalance| × price × (1 + short premium)</li>
                <li>long cost = imbalance × price × long spill loss</li>
                <li>spike: demand actual × (1 + uplift); forecast unchanged</li>
                <li>outage: asset actual = 0; forecast = 0 only after detection lag</li>
                <li>totals shown only if every period is covered and reviewed</li>
              </ul>
            </details>
          </section>

          <section className="card step" aria-labelledby="s5">
            <h2 id="s5"><span className="num">5</span> Trade-offs</h2>
            <p className="muted">Where the fictional money goes in this run. This is an input to prioritisation, not a decision.</p>
            <div className="table-wrap">
              <table>
                <caption className="small">Outage cost by detection lag</caption>
                <thead><tr><th scope="col">Lag</th><th scope="col">Outage cost</th><th scope="col">vs baseline</th></tr></thead>
                <tbody>
                  {lag.map((p) => (
                    <tr key={p.lag} className={p.lag === a.detectionLagSps ? 'hl' : ''}>
                      <td className="mono">{p.lag} SP{p.lag === a.detectionLagSps ? ' (current)' : ''}</td>
                      <td className="mono">{p.costGbp === null ? 'withheld' : gbp(p.costGbp)}</td>
                      <td className="mono">{p.deltaVsBaseline === null ? 'n/a' : signedGbp(p.deltaVsBaseline)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="priorities">
              {perLagSp !== null ? (
                <li><strong>Outage detection.</strong> Each extra settlement period before re-forecasting costs about <span className="mono">{gbp(perLagSp)}</span> here. The outage adds <span className="mono">{gbp(outageDelta)}</span> at {a.detectionLagSps} SP lag.</li>
              ) : <li><strong>Outage detection.</strong> Not quantified: outage scenario is not concluded.</li>}
              {spikeDelta !== null ? (
                <li><strong>Peak demand forecasting.</strong> An unforecast +{a.spikePct}% spike over SP {a.spikeStart}-{a.spikeEnd} adds <span className="mono">{gbp(spikeDelta)}</span>.</li>
              ) : <li><strong>Peak demand forecasting.</strong> Not quantified: spike scenario is not concluded.</li>}
              <li><strong>Data coverage.</strong> {blockedPeriods ? <><span className="mono">{blockedPeriods}</span> of {base.periods.length} periods cannot be valued at all. Until coverage is fixed, every other number on this day is unknowable.</> : 'Complete for this file, so the figures above can be compared.'}</li>
            </ol>
          </section>
        </div>

        <section className="card step" aria-labelledby="s6">
          <h2 id="s6"><span className="num">6</span> Export</h2>
          <div className="export-grid">
            <label className="field"><span>Reviewer name (optional)</span><input value={reviewer} onChange={(e) => setReviewer(e.target.value)} maxLength={80} /></label>
            <label className="field wide"><span>Note for the memo (optional)</span><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></label>
          </div>
          <p className="muted">
            {results.every((r) => r.status === 'ready')
              ? 'All scenarios concluded. The memo includes totals, trade-offs and your review decisions.'
              : 'Some scenarios are not concluded. You can still export: the memo records the blockers and withholds those totals.'}
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={() => download(`decision-memo-${stem}.md`, memo(), 'text/markdown')}>Download decision memo →</button>
            <button type="button" className="btn-ghost" onClick={() => download(`scenarios-${stem}.csv`, scenarioCsv(ds, results), 'text/csv')}>Download scenario CSV</button>
          </div>
          <details className="memo-preview">
            <summary>Preview memo</summary>
            <pre>{memo()}</pre>
          </details>
        </section>
      </main>

      <footer className="foot">
        <p>Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for tem. The tem name and logo belong to their owner and are used only to show brand fit.</p>
        <p>Synthetic data and fictional prices only. Nothing here reflects tem&rsquo;s systems or the Rosso platform. Nothing is traded.</p>
      </footer>
    </>
  );
}
