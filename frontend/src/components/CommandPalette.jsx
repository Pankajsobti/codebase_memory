import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

const MAX_RESULTS = 50;

// Simple fuzzy subsequence matcher: query characters must appear in order
// somewhere in the target string. Consecutive matches and matches right
// after a '/' (path segment boundaries) score higher.
function fuzzyScore(query, target) {
  if (!query) return 0;

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let score = 0;
  let lastMatchIndex = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti += 1) {
    if (t[ti] === q[qi]) {
      score += lastMatchIndex === ti - 1 ? 5 : 1;
      if (ti === 0 || t[ti - 1] === '/') score += 3;
      lastMatchIndex = ti;
      qi += 1;
    }
  }

  if (qi < q.length) return null; // not all query chars matched, in order

  // Slight penalty for longer targets so tighter matches rank first.
  score -= t.length * 0.01;
  return score;
}

export default function CommandPalette({ filePaths = [], onSelectFile }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef(null);
  const listRef = useRef(null);

  const closePalette = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Global Cmd+K / Ctrl+K listener to toggle the palette open.
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (isCmdK) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Reset/focus whenever open state changes.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      // Focus after paint so the input exists in the DOM.
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) {
      return filePaths.slice(0, MAX_RESULTS);
    }

    const scored = [];
    filePaths.forEach((filePath) => {
      const score = fuzzyScore(query, filePath);
      if (score !== null) scored.push({ filePath, score });
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS).map((s) => s.filePath);
  }, [query, filePaths]);

  // Keep the active index in range whenever the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [query, filePaths]);

  // Scroll the active row into view.
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector('[data-active="true"]');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (filePath) => {
      if (onSelectFile) onSelectFile(filePath);
      closePalette();
    },
    [onSelectFile, closePalette]
  );

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length === 0 ? 0 : (prev + 1) % results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (results.length === 0 ? 0 : (prev - 1 + results.length) % results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) handleSelect(selected);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="presentation"
      onMouseDown={closePalette}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        zIndex: 1000,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette: search files"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 90vw)',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search files by path…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: 'var(--space-4)',
            fontSize: 'var(--font-lg)',
            color: 'var(--color-text)',
            background: 'transparent',
            border: 'none',
            borderRadius: 0,
            borderBottom: '1px solid var(--color-border)',
            outline: 'none',
            fontFamily: 'var(--font-family)',
          }}
        />

        <ul
          ref={listRef}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 'var(--space-2) 0',
            overflowY: 'auto',
          }}
        >
          {results.length === 0 && (
            <li
              style={{
                padding: 'var(--space-3) var(--space-4)',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-sm)',
              }}
            >
              No matching files.
            </li>
          )}

          {results.map((filePath, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={filePath}
                data-active={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(filePath);
                }}
                style={{
                  margin: '0 var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--font-sm)',
                  color: isActive ? '#ffffff' : 'var(--color-text)',
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: `background var(--transition-fast), color var(--transition-fast)`,
                }}
                title={filePath}
              >
                {filePath}
              </li>
            );
          })}
        </ul>

        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--font-sm)',
          }}
        >
          ↑↓ navigate · Enter select · Esc close
        </div>
      </div>
    </div>
  );
}
