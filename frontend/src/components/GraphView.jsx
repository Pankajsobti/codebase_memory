// frontend/src/components/GraphView.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { getGraph } from '../api/client.js';
import Toast from './Toast.jsx';
import Skeleton from './Skeleton.jsx';

const NODE_WIDTH = 210;
const NODE_HEIGHT = 68;

// Clean, distinct colors per node type so the legend is actually legible on
// a white canvas. Orange stays reserved for the "calls" edge type and for
// active/selected node emphasis — it is never used as a base type color.
const TYPE_COLORS = {
  file: { border: '#6e6e73', dot: '#6e6e73' },
  function: { border: '#0071e3', dot: '#0071e3' },
  class: { border: '#7c3aed', dot: '#7c3aed' },
  component: { border: '#0d9488', dot: '#0d9488' },
  apiRoute: { border: '#b45309', dot: '#b45309' },
  dbModel: { border: '#be185d', dot: '#be185d' },
  default: { border: '#8a8a8e', dot: '#8a8a8e' },
};

const EDGE_TYPE_COLORS = {
  imports: '#c7c7cc',
  calls: 'var(--color-accent-secondary)',
  renders: '#c7c7cc',
  queries: '#c7c7cc',
  extends: '#c7c7cc',
  default: '#c7c7cc',
};

const LEGEND_ITEMS = [
  { type: 'file', label: 'File' },
  { type: 'function', label: 'Function' },
  { type: 'class', label: 'Class' },
  { type: 'component', label: 'Component' },
  { type: 'apiRoute', label: 'API Route' },
  { type: 'dbModel', label: 'DB Model' },
];

function colorsForType(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.default;
}

function edgeColorForType(type) {
  return EDGE_TYPE_COLORS[type] || EDGE_TYPE_COLORS.default;
}

function NodeLabel({ name, type, colors }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: colors.dot,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            lineHeight: 1.25,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
          title={name}
        >
          {name}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--color-text-dim)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {type || 'node'}
      </span>
    </div>
  );
}

function layoutGraph(rawNodes, rawEdges, direction = 'LR') {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120 });

  rawNodes.forEach((node) => {
    g.setNode(node.nodeId, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });

  rawEdges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  const isHorizontal = direction === 'LR';

  const positionedNodes = rawNodes.map((node) => {
    const { x, y } = g.node(node.nodeId) || { x: 0, y: 0 };
    const colors = colorsForType(node.type);

    return {
      id: node.nodeId,
      data: {
        label: <NodeLabel name={node.label || node.nodeId} type={node.type} colors={colors} />,
        raw: node,
      },
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      targetPosition: isHorizontal ? 'left' : 'top',
      style: {
        background: 'var(--color-surface)',
        border: `1px solid ${colors.border}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        padding: '10px 14px',
        width: NODE_WIDTH,
      },
    };
  });

  const positionedEdges = rawEdges.map((edge, index) => {
    const stroke = edgeColorForType(edge.type);
    return {
      id: `${edge.source}-${edge.target}-${edge.type || index}`,
      source: edge.source,
      target: edge.target,
      label: edge.type,
      type: 'default',
      animated: edge.type === 'calls',
      style: { stroke, strokeWidth: 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 14,
        height: 14,
      },
      labelStyle: { fill: 'var(--color-text-muted)', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: 'var(--color-bg)' },
      labelBgPadding: [4, 2],
      labelBgBorderRadius: 2,
    };
  });

  return { positionedNodes, positionedEdges };
}

function GraphLegend() {
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 20,
        padding: '12px 14px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minWidth: 140,
      }}
    >
      {LEGEND_ITEMS.map(({ type, label }) => {
        const colors = colorsForType(type);
        return (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: colors.dot,
                flexShrink: 0,
              }}
            />
            <span style={{ fontFamily: 'var(--font-family)', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ResetViewIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onPaneClick,
  layoutVersion,
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodes.length === 0) return undefined;

    const raf = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 300 });
    });

    return () => cancelAnimationFrame(raf);
  }, [layoutVersion, fitView]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleResetView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeMouseEnter={onNodeMouseEnter}
      onNodeMouseLeave={onNodeMouseLeave}
      onPaneClick={onPaneClick}
      defaultEdgeOptions={{ type: 'default' }}
      minZoom={0.1}
      maxZoom={2}
    >
      <Background color="var(--color-border)" gap={20} />
      <Controls position="bottom-left" showInteractive={false}>
        <button
          type="button"
          className="react-flow__controls-button react-flow__controls-reset"
          onClick={handleResetView}
          title="Reset view"
          aria-label="Reset view"
        >
          <ResetViewIcon />
        </button>
      </Controls>
      <MiniMap
        position="bottom-right"
        nodeColor={(n) => colorsForType(n.data?.raw?.type).dot}
        nodeBorderRadius={2}
        maskColor="rgba(29, 29, 31, 0.06)"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
        }}
        pannable
        zoomable
      />
      <GraphLegend />
      <style>{`
        .react-flow__node {
          transition: filter var(--transition-fast), border-color var(--transition-fast), opacity var(--transition-fast);
        }
        .react-flow__node:hover {
          filter: brightness(1.03);
        }

        /* Scale the label's own inner wrapper div, NOT .react-flow__node
           itself. The outer .react-flow__node element carries ReactFlow's
           own position transform (translate(x, y)); overwriting it with a
           scale() collapses every node to the same origin point. Scaling
           the child instead keeps position and hover-scale independent. */
        .react-flow__node.gv-node-hovered {
          z-index: 10;
        }
        .react-flow__node.gv-node-hovered > div {
          transform: scale(1.04);
          transform-origin: center;
          transition: transform var(--transition-fast);
        }

        .react-flow__edge-path {
          transition: stroke-width var(--transition-fast), opacity var(--transition-fast);
        }
        .react-flow__edge:hover .react-flow__edge-path {
          stroke-width: 2;
        }
        .react-flow__edge-text {
          font-weight: 500;
        }

        .react-flow__controls {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .react-flow__controls-button {
          background: transparent;
          border-bottom: 1px solid var(--color-border);
          color: var(--color-text);
          transition: background var(--transition-fast);
        }
        .react-flow__controls-button:last-child {
          border-bottom: none;
        }
        .react-flow__controls-button:hover {
          background: var(--color-bg-subtle);
        }
        .react-flow__controls-button svg {
          fill: var(--color-text);
        }
        .react-flow__controls-reset svg {
          fill: none;
        }

        .react-flow__minimap {
          overflow: hidden;
        }

        .react-flow__attribution {
          background: transparent;
          color: var(--color-text-dim);
          font-size: var(--font-xs);
        }

        .gv-search-input-wrap {
          transition: border-color var(--transition-base), box-shadow var(--transition-base);
        }
        .gv-search-input-wrap:focus-within {
          border-color: var(--color-accent) !important;
          box-shadow: var(--shadow-md);
        }
        .gv-search-input::placeholder {
          color: var(--color-text-dim);
        }
      `}</style>
    </ReactFlow>
  );
}

export default function GraphView({ repoId, graphType, onNodeSelect, highlightedNodeId }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawNodeCount, setRawNodeCount] = useState(0);
  const [retryToken, setRetryToken] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    if (!repoId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getGraph(repoId, graphType)
      .then((data) => {
        if (cancelled) return;
        const rawNodes = data?.nodes || [];
        const rawEdges = data?.edges || [];
        setRawNodeCount(rawNodes.length);

        // eslint-disable-next-line no-console
        console.log('[GraphView] raw API response for', graphType, data);
        // eslint-disable-next-line no-console
        console.log('[GraphView] rawNodes.length =', rawNodes.length, 'rawEdges.length =', rawEdges.length);

        const nodeIdSet = new Set(rawNodes.map((n) => n.nodeId));
        const orphanEdges = rawEdges.filter(
          (e) => !nodeIdSet.has(e.source) || !nodeIdSet.has(e.target)
        );
        if (orphanEdges.length > 0) {
          // eslint-disable-next-line no-console
          console.warn(
            '[GraphView] found edges whose source/target do NOT match any nodeId:',
            orphanEdges
          );
        }

        // REAL duplicate check: nodeId is the actual unique identity of a
        // node (backend has a unique index on {repoId, nodeId}), so if two
        // entries ever share a nodeId that's an actual data bug.
        const nodeIdCounts = rawNodes.reduce((acc, n) => {
          acc[n.nodeId] = (acc[n.nodeId] || 0) + 1;
          return acc;
        }, {});
        const trueDuplicateNodeIds = Object.entries(nodeIdCounts).filter(([, count]) => count > 1);
        if (trueDuplicateNodeIds.length > 0) {
          // eslint-disable-next-line no-console
          console.error('[GraphView] REAL duplicate nodeIds (should never happen):', trueDuplicateNodeIds);
        }

        // Informational only: the same function/class NAME (label) can
        // legitimately appear in multiple different files (e.g. "escalate_call"
        // defined in several modules) — each has its own distinct nodeId
        // (filePath::name::startLine), so this is expected and NOT a bug.
        const labelCounts = rawNodes.reduce((acc, n) => {
          const key = n.label || n.nodeId;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        const reusedNames = Object.entries(labelCounts).filter(([, count]) => count > 1);

        setDebugInfo({
          nodeCount: rawNodes.length,
          edgeCount: rawEdges.length,
          orphanEdgeCount: orphanEdges.length,
          duplicateNodeIdCount: trueDuplicateNodeIds.length,
          reusedNameCount: reusedNames.length,
          sampleEdge: rawEdges[0] || null,
          sampleNode: rawNodes[0] || null,
        });

        const { positionedNodes, positionedEdges } = layoutGraph(rawNodes, rawEdges);
        setNodes(positionedNodes);
        setEdges(positionedEdges);
        setHoveredNodeId(null);
        setSelectedNodeId(null);
        setLayoutVersion((v) => v + 1);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load graph');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoId, graphType, retryToken, setNodes, setEdges]);

  useEffect(() => {
    const query = searchQuery.trim().toLowerCase();
    const isSearchActive = query.length > 0;

    const isHoverActive = Boolean(hoveredNodeId);
    const connectedToHover = new Set();
    if (isHoverActive) {
      connectedToHover.add(hoveredNodeId);
      edges.forEach((e) => {
        if (e.source === hoveredNodeId) connectedToHover.add(e.target);
        if (e.target === hoveredNodeId) connectedToHover.add(e.source);
      });
    }

    setNodes((nds) =>
      nds.map((n) => {
        const isPropHighlighted = n.id === highlightedNodeId;
        const isSelected = n.id === selectedNodeId;
        const isHovered = n.id === hoveredNodeId;
        const isHoverConnected = isHoverActive && connectedToHover.has(n.id);
        const isHoverDimmed = isHoverActive && !connectedToHover.has(n.id);

        const raw = n.data?.raw;
        const label = (raw?.label || raw?.nodeId || '').toLowerCase();
        const filePath = (raw?.filePath || '').toLowerCase();
        const matchesSearch = isSearchActive && (label.includes(query) || filePath.includes(query));

        const isSearchHighlighted = isPropHighlighted || matchesSearch;
        const isSearchDimmed = isSearchActive && !matchesSearch && !isPropHighlighted;

        const nodeColors = colorsForType(raw?.type);
        const borderColor = nodeColors.border;

        // Flat border swap instead of glow/box-shadow — depth comes from
        // the 1px border, not a blurred ring. Orange accent (secondary) is
        // reserved for selected/highlighted emphasis only.
        let border;
        if (isSelected || isSearchHighlighted) {
          border = '1px solid var(--color-accent-secondary)';
        } else if (isHoverConnected) {
          border = `1px solid ${borderColor}`;
        } else {
          border = `1px solid ${borderColor}`;
        }

        const isEmphasized = isSelected || isSearchHighlighted || isHovered;
        const isDimmed = (!isSelected && !isSearchHighlighted) && (isSearchDimmed || isHoverDimmed);

        return {
          ...n,
          // Hover-scale is applied via this className only (see the
          // .gv-node-hovered CSS rule in GraphCanvas), which scales just the
          // inner label div. `transform` must never be set in this style
          // object — it collides with ReactFlow's own position transform on
          // the outer node element and collapses every node to one spot.
          className: isHovered ? 'gv-node-hovered' : undefined,
          style: {
            ...n.style,
            border,
            boxShadow: isEmphasized ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            zIndex: isEmphasized ? 10 : undefined,
            opacity: isDimmed ? 0.3 : 1,
          },
        };
      })
    );
  }, [highlightedNodeId, searchQuery, hoveredNodeId, selectedNodeId, edges, rawNodeCount, retryToken, setNodes]);

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const isConnected = hoveredNodeId && (e.source === hoveredNodeId || e.target === hoveredNodeId);
        const isDimmed = Boolean(hoveredNodeId) && !isConnected;

        return {
          ...e,
          style: {
            ...e.style,
            strokeWidth: isConnected ? 2 : 1,
            opacity: isDimmed ? 0.15 : 1,
          },
        };
      })
    );
  }, [hoveredNodeId, setEdges]);

  const handleNodeClick = useCallback(
    (_event, node) => {
      if (onNodeSelect) onNodeSelect(node.data.raw);
      setSelectedNodeId((prev) => (prev === node.id ? null : node.id));
    },
    [onNodeSelect]
  );

  const handleNodeMouseEnter = useCallback((_event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleRetry = useCallback(() => {
    setRetryToken((t) => t + 1);
  }, []);

  const handleSearchChange = useCallback((event) => {
    setSearchQuery(event.target.value);
  }, []);

  const containerStyle = useMemo(
    () => ({ width: '100%', height: '100%', minHeight: 480, position: 'relative' }),
    []
  );

  if (loading) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Skeleton variant="spinner" size={28} label="Loading graph…" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Toast message={`Couldn't load graph: ${error}`} onDismiss={() => setError(null)} />
        <div style={{ textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleRetry}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-md)',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (rawNodeCount === 0) {
    return (
      <div style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-md)', textAlign: 'center' }}>
          No nodes found for this graph type yet.
          <br />
          Try a different view or wait for parsing to finish.
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        className="gv-search-input-wrap"
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 20,
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search nodes…"
          className="gv-search-input"
          style={{
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-family)',
            fontSize: 'var(--font-sm, var(--font-md))',
            fontWeight: 500,
            width: 200,
            outline: 'none',
          }}
        />
      </div>
      <ReactFlowProvider>
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onNodeMouseEnter={handleNodeMouseEnter}
          onNodeMouseLeave={handleNodeMouseLeave}
          onPaneClick={handlePaneClick}
          layoutVersion={layoutVersion}
        />
      </ReactFlowProvider>

      {debugInfo && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 30,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: debugInfo.edgeCount === 0 ? 'var(--color-accent-secondary)' : 'var(--color-text)',
            lineHeight: 1.6,
            maxWidth: 320,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>DEBUG (check console for details)</div>
          <div>nodes: {debugInfo.nodeCount}</div>
          <div>edges: {debugInfo.edgeCount} {debugInfo.edgeCount === 0 ? '⚠️ NO EDGES IN API RESPONSE' : ''}</div>
          <div>
            orphan edges (bad source/target): {debugInfo.orphanEdgeCount}{' '}
            {debugInfo.orphanEdgeCount > 0 ? '⚠️' : ''}
          </div>
          <div style={{ color: debugInfo.duplicateNodeIdCount > 0 ? 'var(--color-accent-secondary)' : 'inherit' }}>
            duplicate nodeIds (real bug if &gt;0): {debugInfo.duplicateNodeIdCount}{' '}
            {debugInfo.duplicateNodeIdCount > 0 ? '⚠️' : ''}
          </div>
          <div>same-name functions across different files: {debugInfo.reusedNameCount}</div>
        </div>
      )}
    </div>
  );
}
