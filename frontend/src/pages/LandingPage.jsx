import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

const STEPS = [
  {
    marker: '01',
    title: 'Clone & ingest',
    desc: 'Paste a repo URL. Codebase Memory clones it and reads every file, tracking status from pending through ready.',
  },
  {
    marker: '02',
    title: 'Parse & map',
    desc: 'Tree-sitter walks each file and extracts its imports, exports, functions, and classes into structured records.',
  },
  {
    marker: '03',
    title: 'Ask anything',
    desc: 'Query the graph in plain English and get answers grounded in the exact nodes and edges behind your code.',
  },
];

const FEATURES = [
  {
    tag: 'imports',
    title: 'Import graph',
    desc: 'See exactly how every file in the repo imports every other file, edge by edge, without opening a single tab.',
  },
  {
    tag: 'calls · renders',
    title: 'Call & render tracing',
    desc: 'Follow function calls and component renders across the codebase to understand how a change will ripple outward.',
  },
  {
    tag: 'routes · models',
    title: 'API & data routes',
    desc: 'Surface every Express route alongside the database models it reads and writes, mapped in one place.',
  },
  {
    tag: 'q&a',
    title: 'Grounded Q&A',
    desc: 'Ask a question about the codebase and get an answer tied to the specific graph nodes that support it.',
  },
];

function HeroGraph() {
  return (
    <svg
      className="hero__graph"
      viewBox="0 0 420 320"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Diagram of files, functions, and routes connected as a graph"
    >
      <line x1="70" y1="60" x2="200" y2="40" stroke="#232326" strokeWidth="1" />
      <line x1="200" y1="40" x2="330" y2="90" stroke="#232326" strokeWidth="1" />
      <line x1="70" y1="60" x2="120" y2="180" stroke="#232326" strokeWidth="1" />
      <line x1="200" y1="40" x2="220" y2="170" stroke="#ff6b35" strokeWidth="1.5" />
      <line x1="220" y1="170" x2="120" y2="180" stroke="#232326" strokeWidth="1" />
      <line x1="220" y1="170" x2="330" y2="90" stroke="#232326" strokeWidth="1" />
      <line x1="120" y1="180" x2="150" y2="270" stroke="#232326" strokeWidth="1" />
      <line x1="220" y1="170" x2="290" y2="260" stroke="#232326" strokeWidth="1" />

      <circle cx="70" cy="60" r="5" fill="#0a0a0b" stroke="#8a8a86" strokeWidth="1.5" />
      <text x="84" y="58" className="node-label">FileRecord</text>

      <circle cx="200" cy="40" r="5" fill="#0a0a0b" stroke="#8a8a86" strokeWidth="1.5" />
      <text x="214" y="38" className="node-label">imports</text>

      <circle cx="330" cy="90" r="5" fill="#0a0a0b" stroke="#8a8a86" strokeWidth="1.5" />
      <text x="300" y="76" className="node-label">apiRoute</text>

      <circle cx="220" cy="170" r="6" fill="#0a0a0b" stroke="#ff6b35"strokeWidth="2" />
      <text x="234" y="168" className="node-label">function</text>

      <circle cx="120" cy="180" r="5" fill="#0a0a0b" stroke="#8a8a86" strokeWidth="1.5" />
      <text x="60" y="200" className="node-label">class</text>

      <circle cx="150" cy="270" r="5" fill="#0a0a0b" stroke="#8a8a86" strokeWidth="1.5" />
      <text x="100" y="292" className="node-label">calls</text>

      <circle cx="290" cy="260" r="5" fill="#0a0a0b" stroke="#8a8a86" strokeWidth="1.5" />
      <text x="240" y="286" className="node-label">dbModel</text>
    </svg>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <section className="hero">
        <div className="landing__inner hero__grid">
          <div>
            <span className="eyebrow">repo // graph // answers</span>
            <h1 className="hero__title">
              Codebase
              <br />
              <span className="dim">Memory</span>
            </h1>
            <p className="hero__subtitle">
              Point it at a repo. It parses every file, builds a live graph of imports, calls,
              and routes, and answers questions about how your code actually works.
            </p>
            <div className="hero__cta-row">
              <button type="button" className="btn-cta" onClick={() => navigate('/app')}>
                $ analyze_repo
              </button>
              <span className="hero__hint">// no setup beyond a repo URL</span>
            </div>
          </div>
          <div>
            <HeroGraph />
          </div>
        </div>
      </section>

      <section className="how">
        <div className="landing__inner">
          <span className="eyebrow">pipeline</span>
          <h2 className="how__heading">How it works</h2>
          <p className="how__lead">
            Three stages turn a raw repository into a graph you can query, run automatically
            each time you submit a new repo.
          </p>
          <div className="how__pipeline">
            {STEPS.map((step) => (
              <div className="step" key={step.marker}>
                <div className="step__marker">{step.marker}</div>
                <h3 className="step__title">{step.title}</h3>
                <p className="step__desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="features">
        <div className="landing__inner">
          <span className="eyebrow">what you get</span>
          <h2 className="features__heading">Built for understanding, not just search</h2>
          <p className="features__lead">
            Every card below maps directly to a part of the graph Codebase Memory builds behind
            the scenes.
          </p>
          <div className="features__grid">
            {FEATURES.map((feature) => (
              <div className="card" key={feature.title}>
                <span className="card__tag">// {feature.tag}</span>
                <h3 className="card__title">{feature.title}</h3>
                <p className="card__desc">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
