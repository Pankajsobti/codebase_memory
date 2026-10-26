// frontend/src/components/SummaryPanel.jsx
import { useEffect, useState } from 'react';
import { Sparkles, FileCode2, FunctionSquare, Layers } from 'lucide-react';
import { getSummary } from '../api/client.js';

// Distinct color per language for the breakdown bars. Falls back to a
// cycling accent palette for languages not explicitly listed, so any
// number of languages still reads clearly against the dark theme.
const LANGUAGE_COLORS = {
  javascript: '#fbbf24',
  js: '#fbbf24',
  jsx: '#fbbf24',
  typescript: '#38bdf8',
  ts: '#38bdf8',
  tsx: '#38bdf8',
  python: '#60a5fa',
  py: '#60a5fa',
  java: '#f97316',
  go: '#22d3ee',
  rust: '#fb7185',
  ruby: '#f43f5e',
  css: '#a78bfa',
  html: '#fb923c',
  json: '#94a3b8',
  markdown: '#4ade80',
  md: '#4ade80',
};

const FALLBACK_PALETTE = ['#14b8a6', '#a78bfa', '#f472b6', '#4ade80', '#fb923c', '#60a5fa'];

function getLanguageColor(lang, index) {
  const key = (lang || '').toLowerCase();
  return LANGUAGE_COLORS[key] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

function StatCard({ icon: Icon, value, label }) {
  return (
    <div
      className="stat-card"
      style={{
        flex: 1,
        minWidth: 120,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        padding: 'var(--space-4)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-subtle)',
        boxShadow: 'var(--shadow-sm)',
        transition: 'box-shadow var(--transition-base), transform var(--transition-base)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-accent-bg)',
          border: '1px solid var(--color-accent-border)',
          color: 'var(--color-accent-text)',
          flexShrink: 0,
        }}
      >
        <Icon size={15} strokeWidth={2} />
      </div>
      <div style={{ fontSize: 'calc(var(--font-xl) + 8px)', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontSize: 'var(--font-xs)',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function LanguageBar({ lang, count, percentage, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <span
        style={{
          fontSize: 'var(--font-sm)',
          width: 96,
          flexShrink: 0,
          color: 'var(--color-text)',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={lang}
      >
        {lang}
      </span>

      <div
        style={{
          flex: 1,
          background: 'var(--color-surface-alt)',
          borderRadius: 'var(--radius-pill)',
          height: 8,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: color,
            borderRadius: 'var(--radius-pill)',
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </div>

      <span
        style={{
          fontSize: 'var(--font-sm)',
          width: 92,
          flexShrink: 0,
          textAlign: 'right',
          color: 'var(--color-text-muted)',
        }}
      >
        {count} · {percentage}%
      </span>
    </div>
  );
}

export default function SummaryPanel({ repoId }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!repoId) return undefined;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getSummary(repoId)
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.data?.error || err.message || 'Failed to load summary.');
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const fadeInStyle = (
    <style>{`
      @keyframes summaryFadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .summary-fade-in {
        animation: summaryFadeIn 0.4s ease both;
      }
      .overview-grid {
        display: grid;
        grid-template-columns: 1.6fr 1fr;
        gap: var(--space-5);
        align-items: start;
      }
      @media (max-width: 900px) {
        .overview-grid {
          grid-template-columns: 1fr;
        }
      }
      .stat-card:hover {
        box-shadow: var(--shadow-md);
        transform: translateY(-2px);
      }
    `}</style>
  );

  if (isLoading) {
    return (
      <>
        {fadeInStyle}
        <div
          className="summary-fade-in"
          style={{
            padding: 'var(--space-6)',
            fontSize: 'var(--font-md)',
            color: 'var(--color-text-muted)',
          }}
        >
          Loading summary…
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {fadeInStyle}
        <div
          className="summary-fade-in"
          style={{
            padding: 'var(--space-6)',
            fontSize: 'var(--font-md)',
            color: 'var(--color-error)',
          }}
        >
          {error}
        </div>
      </>
    );
  }

  if (!summary) return null;

  const { languageBreakdown, totalFiles, avgFunctionsPerFile, aiSummary } = summary;
  const entries = Object.entries(languageBreakdown || {}).sort((a, b) => b[1] - a[1]);
  const totalCount = entries.reduce((sum, [, count]) => sum + count, 0) || 1;

  return (
    <>
      {fadeInStyle}
      <div
        className="summary-fade-in"
        style={{
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-5)',
          maxWidth: 1200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Stat cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <StatCard icon={FileCode2} value={totalFiles} label={totalFiles === 1 ? 'File' : 'Files'} />
          <StatCard icon={FunctionSquare} value={avgFunctionsPerFile} label="Avg fn / file" />
          <StatCard icon={Layers} value={entries.length} label={entries.length === 1 ? 'Language' : 'Languages'} />
        </div>

        {/* Architecture summary + Language breakdown, side by side */}
        <div className="overview-grid">
          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-subtle)',
              boxShadow: 'var(--shadow-md)',
              padding: 'var(--space-6)',
              height: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent-bg)',
                  border: '1px solid var(--color-accent-border)',
                  color: 'var(--color-accent-text)',
                  flexShrink: 0,
                }}
              >
                <Sparkles size={16} strokeWidth={2} />
              </div>
              <h2 style={{ fontSize: 'var(--font-xl)', margin: 0, fontWeight: 700, color: 'var(--color-text)' }}>
                Architecture summary
              </h2>
            </div>

            <p style={{ fontSize: 'var(--font-md)', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.7 }}>
              {aiSummary}
            </p>
          </div>

          <div
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-subtle)',
              boxShadow: 'var(--shadow-sm)',
              padding: 'var(--space-6)',
              height: '100%',
            }}
          >
            <h3
              style={{
                fontSize: 'var(--font-lg)',
                margin: '0 0 var(--space-4)',
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              Language breakdown
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {entries.map(([lang, count], index) => (
                <LanguageBar
                  key={lang}
                  lang={lang}
                  count={count}
                  percentage={((count / totalCount) * 100).toFixed(1)}
                  color={getLanguageColor(lang, index)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}