import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FolderGit2, LayoutDashboard, Network, FolderTree, MessageSquare } from 'lucide-react';
import GraphView from '../components/GraphView.jsx';
import FileExplorer from '../components/FileExplorer.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import CommandPalette from '../components/CommandPalette.jsx';
import { getRepo, getGraph } from '../api/client.js';
import SummaryPanel from '../components/SummaryPanel.jsx';
import Alert from '../components/Alert.jsx';
import Skeleton from '../components/Skeleton.jsx';

const GRAPH_TYPES = [
  { value: 'dependency', label: 'Dependency graph' },
  { value: 'call', label: 'Call graph' },
];

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'graph', label: 'Graph', icon: Network },
  { key: 'files', label: 'Files', icon: FolderTree },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
];

const POLL_INTERVAL_MS = 2000;
const IN_PROGRESS_STATUSES = new Set(['pending', 'cloning', 'parsing']);

const STATUS_LABELS = {
  pending: 'Queued…',
  cloning: 'Cloning repository…',
  parsing: 'Parsing files…',
};

// Status pill colors: neutral gray for in-progress states, green for
// "ready", red reserved for "failed" — matches the dashboard's convention.
const STATUS_META = {
  ready: { label: 'Ready', dot: 'var(--color-success)', text: 'var(--color-success)', bg: 'var(--color-success-bg)', border: 'var(--color-success-border)' },
  pending: { label: 'Pending', dot: 'var(--color-text-muted)', text: 'var(--color-text-muted)', bg: 'var(--color-bg-subtle)', border: 'var(--color-border)' },
  cloning: { label: 'Cloning', dot: 'var(--color-text-muted)', text: 'var(--color-text-muted)', bg: 'var(--color-bg-subtle)', border: 'var(--color-border)' },
  parsing: { label: 'Parsing', dot: 'var(--color-text-muted)', text: 'var(--color-text-muted)', bg: 'var(--color-bg-subtle)', border: 'var(--color-border)' },
  failed: { label: 'Failed', dot: 'var(--color-error)', text: 'var(--color-error)', bg: 'var(--color-error-bg)', border: 'var(--color-error-border)' },
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || {
    label: status,
    dot: 'var(--color-text-muted)',
    text: 'var(--color-text-muted)',
    bg: 'var(--color-bg-subtle)',
    border: 'var(--color-border)',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
        fontFamily: 'var(--font-family)',
        fontSize: 'var(--font-sm)',
        fontWeight: 600,
        padding: 'var(--space-1) var(--space-3)',
        borderRadius: 'var(--radius-pill)',
        border: `1px solid ${meta.border}`,
        background: meta.bg,
        color: meta.text,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: meta.dot,
          flexShrink: 0,
        }}
      />
      {meta.label}
    </span>
  );
}

export default function RepoViewPage() {
  const { repoId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [graphType, setGraphType] = useState('dependency');
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);

  const [repoStatus, setRepoStatus] = useState(null);
  const [repoMeta, setRepoMeta] = useState({ owner: null, name: null });
  const [statusError, setStatusError] = useState(null);
  const [statusRetryToken, setStatusRetryToken] = useState(0);
  const timerRef = useRef(null);

  // Tab underline indicator: tracks the pixel position/width of the active
  // tab button so the underline can slide smoothly between tabs.
  const navRef = useRef(null);
  const tabRefs = useRef({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [hoveredTab, setHoveredTab] = useState(null);

  // File list for the command palette, loaded the same way FileExplorer
  // loads its tree (via the dependency graph's nodes). We also keep a
  // filePath -> nodeId map so selecting a file in the palette can highlight
  // the corresponding node in GraphView.
  const [commandPaletteFilePaths, setCommandPaletteFilePaths] = useState([]);
  const filePathToNodeIdRef = useRef({});

  useEffect(() => {
    if (!repoId) return undefined;

    let cancelled = false;

    getGraph(repoId, 'dependency')
      .then((data) => {
        if (cancelled) return;
        const rawNodes = data?.nodes || [];
        const pathToNodeId = {};

        rawNodes.forEach((node) => {
          if (!node.filePath) return;
          if (!pathToNodeId[node.filePath] || node.type === 'file') {
            pathToNodeId[node.filePath] = node.nodeId;
          }
        });

        filePathToNodeIdRef.current = pathToNodeId;
        setCommandPaletteFilePaths(Object.keys(pathToNodeId).sort());
      })
      .catch(() => {
        // Best-effort: the command palette simply has no results if this fails.
      });

    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const handlePaletteSelectFile = useCallback((filePath) => {
    const nodeId = filePathToNodeIdRef.current[filePath];
    if (nodeId) {
      setHighlightedNodeId(nodeId);
    }
  }, []);

  useEffect(() => {
    if (!repoId) return undefined;

    let cancelled = false;

    const poll = () => {
      getRepo(repoId)
        .then((data) => {
          if (cancelled) return;
          setStatusError(null);
          setRepoStatus(data.status);
          setRepoMeta({ owner: data.owner, name: data.name });

          if (IN_PROGRESS_STATUSES.has(data.status)) {
            timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setStatusError(err?.data?.error || err.message || 'Failed to load repository status.');
          timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        });
    };

    poll();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [repoId, statusRetryToken]);

  const handleRetryStatus = () => setStatusRetryToken((t) => t + 1);

  const repoDisplayName = repoMeta.owner && repoMeta.name
    ? `${repoMeta.owner}/${repoMeta.name}`
    : repoId;

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const el = tabRefs.current[activeTab];
      const nav = navRef.current;
      if (!el || !nav) return;
      const elRect = el.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      setIndicator({ left: elRect.left - navRect.left, width: elRect.width });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTab, repoStatus]);

  if (repoStatus === null || IN_PROGRESS_STATUSES.has(repoStatus)) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'var(--font-family)',
          padding: 'var(--space-6)',
          background: 'var(--color-bg)',
        }}
      >
        <Skeleton
          variant="spinner"
          size={32}
          label={STATUS_LABELS[repoStatus] || 'Loading repository…'}
        />
        {statusError && (
          <div style={{ marginTop: 'var(--space-4)', width: '100%', maxWidth: 420 }}>
            <Alert message={statusError} onRetry={handleRetryStatus} onDismiss={() => setStatusError(null)} />
          </div>
        )}
      </div>
    );
  }

  if (repoStatus === 'failed') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'var(--font-family)',
          padding: 'var(--space-6)',
          background: 'var(--color-bg)',
        }}
      >
        <h1 style={{ fontSize: 'var(--font-xl)', marginBottom: 'var(--space-4)', textAlign: 'center', color: 'var(--color-text)' }}>
          Repository processing failed
        </h1>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Alert
            message="We couldn't finish ingesting or parsing this repository. You can try again, or go back and re-submit the repo."
            onRetry={handleRetryStatus}
            retryLabel="Check again"
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'var(--font-family)', background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {/* Header: repo owner/name + status, visible on every tab */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
          flexShrink: 0,
          gap: 'var(--space-4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-bg)',
              border: '1px solid var(--color-accent-border)',
              color: 'var(--color-accent-text)',
              flexShrink: 0,
            }}
          >
            <FolderGit2 size={18} strokeWidth={2} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: 'var(--font-family)',
                fontSize: 'var(--font-xs)',
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Repo view
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-family)',
                fontSize: 'calc(var(--font-xl) + 3px)',
                margin: 0,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
              title={repoDisplayName}
            >
              {repoDisplayName}
            </h1>
          </div>
        </div>

        <StatusPill status={repoStatus} />
      </header>

      {/* Tab nav: Apple-style floating segmented control, visible on every tab */}
      <div
        style={{
          padding: 'var(--space-4) var(--space-6) 0',
          background: 'var(--color-bg)',
          flexShrink: 0,
        }}
      >
        <nav
          ref={navRef}
          style={{
            position: 'relative',
            display: 'inline-flex',
            gap: 2,
            padding: 4,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-bg-subtle)',
            border: '1px solid var(--color-border)',
          }}
        >
          {/* Sliding pill indicator sits behind the active tab's label */}
          <span
            style={{
              position: 'absolute',
              top: 4,
              left: indicator.left,
              width: indicator.width,
              height: 'calc(100% - 8px)',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-bg)',
              boxShadow: 'var(--shadow-sm)',
              transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1), width 0.25s cubic-bezier(0.4,0,0.2,1)',
              zIndex: 0,
            }}
          />

          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                ref={(el) => {
                  tabRefs.current[tab.key] = el;
                }}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-4)',
                  fontFamily: 'var(--font-family)',
                  fontSize: 'var(--font-md)',
                  border: 'none',
                  borderRadius: 'var(--radius-pill)',
                  background: 'transparent',
                  color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)',
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'color var(--transition-base)',
                }}
              >
                <Icon size={15} strokeWidth={2} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Active tab content only — others are unmounted */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {activeTab === 'overview' && <SummaryPanel repoId={repoId} />}

        {activeTab === 'graph' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <CommandPalette filePaths={commandPaletteFilePaths} onSelectFile={handlePaletteSelectFile} />

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                padding: 'var(--space-3) var(--space-5)',
                borderBottom: '1px solid var(--color-border)',
                flexShrink: 0,
              }}
            >
              {GRAPH_TYPES.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setGraphType(option.value)}
                  style={{
                    padding: 'var(--space-2) var(--space-4)',
                    fontFamily: 'var(--font-family)',
                    fontSize: 'var(--font-md)',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-pill)',
                    border: `1px solid ${graphType === option.value ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: graphType === option.value ? 'var(--color-accent)' : 'var(--color-bg)',
                    color: graphType === option.value ? 'var(--color-primary-text)' : 'var(--color-text)',
                    boxShadow: graphType === option.value ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    transition: 'background var(--transition-base), box-shadow var(--transition-base)',
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <GraphView
                  repoId={repoId}
                  graphType={graphType}
                  onNodeSelect={setSelectedNode}
                  highlightedNodeId={highlightedNodeId}
                />
              </div>

              {selectedNode && (
                <aside
                  style={{
                    width: 280,
                    borderLeft: '1px solid var(--color-border)',
                    background: 'var(--color-bg)',
                    padding: 'var(--space-4)',
                    overflowY: 'auto',
                    fontSize: 'var(--font-md)',
                    flexShrink: 0,
                  }}
                >
                  <h2 style={{ fontFamily: 'var(--font-family)', fontWeight: 700, fontSize: 'var(--font-lg)', marginTop: 0 }}>{selectedNode.label}</h2>
                  <p style={{ color: 'var(--color-text-muted)', margin: 'var(--space-1) 0' }}>Type: {selectedNode.type}</p>
                  {selectedNode.filePath && (
                    <p style={{ color: 'var(--color-text-muted)', margin: 'var(--space-1) 0', wordBreak: 'break-all' }}>
                      {selectedNode.filePath}
                    </p>
                  )}
                </aside>
              )}
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div style={{ height: '100%', overflowY: 'auto' }}>
            <FileExplorer repoId={repoId} />
          </div>
        )}

        {activeTab === 'chat' && (
          <div style={{ height: '100%' }}>
            <ChatPanel repoId={repoId} onNodeHighlight={setHighlightedNodeId} />
          </div>
        )}
      </div>
    </div>
  );
}
