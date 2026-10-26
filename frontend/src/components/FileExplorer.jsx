// frontend/src/components/FileExplorer.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/themes/prism-tomorrow.css';
import {
  Folder,
  FolderOpen,
  FileCode2,
  FileJson2,
  FileText,
  ChevronRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  Code2,
  Box,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { getGraph, getFileRecord } from '../api/client.js';
import Toast from './Toast.jsx';
import Skeleton from './Skeleton.jsx';
import './FileExplorer.css';

const PRISM_LANGUAGE_BY_LANGUAGE = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
};

// Colors are additive UI sugar only — do not affect data shape/props.
const FILE_TYPE_COLORS = {
  js: '#f7df1e',
  jsx: '#61dafb',
  ts: '#3b82f6',
  tsx: '#3b82f6',
  py: '#3776ab',
  json: '#f59e0b',
  css: '#a78bfa',
  html: '#f97316',
  md: '#9aa1ac',
};

const LANGUAGE_COLORS = {
  javascript: '#f7df1e',
  typescript: '#3b82f6',
  python: '#3776ab',
  java: '#e76f00',
};

function getExt(name) {
  const idx = name.lastIndexOf('.');
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase();
}

function getFileColor(name) {
  return FILE_TYPE_COLORS[getExt(name)] || 'var(--color-text-muted)';
}

function getFileIconComponent(name) {
  const ext = getExt(name);
  if (ext === 'json') return FileJson2;
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'java'].includes(ext)) return FileCode2;
  return FileText;
}

function getLanguageColor(language) {
  return LANGUAGE_COLORS[language] || 'var(--color-text-muted)';
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#')) return `rgba(154, 161, 172, ${alpha})`;
  const clean = hex.slice(1);
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function buildTree(filePaths) {
  const root = { name: '', path: '', type: 'dir', children: {} };

  filePaths.forEach((filePath) => {
    const parts = filePath.split('/').filter(Boolean);
    let current = root;

    parts.forEach((part, idx) => {
      const isLeaf = idx === parts.length - 1;
      const path = parts.slice(0, idx + 1).join('/');

      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          path,
          type: isLeaf ? 'file' : 'dir',
          children: {},
        };
      }

      current = current.children[part];
    });
  });

  return root;
}

function IndentGuides({ depth }) {
  if (depth === 0) return null;
  return (
    <span className="fe-indent-guides" style={{ width: depth * 14 }} aria-hidden="true">
      {Array.from({ length: depth }).map((_, i) => (
        <span key={i} className="fe-indent-guide" style={{ left: i * 14 + 6 }} />
      ))}
    </span>
  );
}

function TreeNode({ node, depth, expandedDirs, onToggleDir, selectedPath, onSelectFile }) {
  const isDir = node.type === 'dir';
  const isExpanded = expandedDirs.has(node.path);
  const childNodes = useMemo(
    () =>
      Object.values(node.children).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [node.children]
  );

  if (isDir) {
    const FolderIcon = isExpanded ? FolderOpen : Folder;
    return (
      <li className="fe-node">
        <button type="button" className="fe-row fe-row--dir" onClick={() => onToggleDir(node.path)}>
          <IndentGuides depth={depth} />
          <ChevronRight size={12} className={`fe-caret-icon ${isExpanded ? 'fe-caret-icon--open' : ''}`} />
          <FolderIcon size={14} className="fe-dir-icon" />
          <span className="fe-label">{node.name}</span>
        </button>
        {isExpanded && childNodes.length > 0 && (
          <ul className="fe-children">
            {childNodes.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const isSelected = node.path === selectedPath;
  const FileIcon = getFileIconComponent(node.name);
  const fileColor = getFileColor(node.name);

  return (
    <li className="fe-node">
      <button
        type="button"
        className={`fe-row fe-row--file ${isSelected ? 'fe-row--selected' : ''}`}
        onClick={() => onSelectFile(node.path)}
      >
        <IndentGuides depth={depth} />
        <span className="fe-file-dot" style={{ background: fileColor, boxShadow: `0 0 5px ${hexToRgba(fileColor, 0.6)}` }} />
        <FileIcon size={13} className="fe-file-icon" style={{ color: fileColor }} />
        <span className="fe-label">{node.name}</span>
      </button>
    </li>
  );
}

function DetailCard({ icon: Icon, title, items, accent, renderItem }) {
  return (
    <div className="fe-card" style={{ '--card-accent': accent }}>
      <div className="fe-card-header">
        <span className="fe-card-icon-wrap">
          <Icon size={13} className="fe-card-icon" />
        </span>
        <span className="fe-card-title">{title}</span>
        <span className="fe-card-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="fe-detail-empty">None</p>
      ) : (
        <ul className="fe-card-list">
          {items.map((item, idx) => (
            <li key={idx} className="fe-card-list-item">
              {renderItem ? renderItem(item) : item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreviewSection({ content, language }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    if (isOpen && codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [isOpen, content, language]);

  if (!content) {
    return null;
  }

  const prismLanguage = PRISM_LANGUAGE_BY_LANGUAGE[language] || 'markup';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy file content:', err);
    }
  };

  return (
    <section className="fe-card fe-preview-card">
      <div className="fe-preview-header">
        <button type="button" className="fe-preview-toggle" onClick={() => setIsOpen((prev) => !prev)}>
          <ChevronRight size={12} className={`fe-caret-icon ${isOpen ? 'fe-caret-icon--open' : ''}`} />
          <Eye size={13} />
          Preview
        </button>
        {isOpen && (
          <button type="button" className="fe-preview-copy" onClick={handleCopy}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {isOpen && (
        <pre className="fe-preview-pre">
          <code ref={codeRef} className={`language-${prismLanguage}`}>
            {content}
          </code>
        </pre>
      )}
    </section>
  );
}

function FileDetailPanel({ filePath, detail, loading, error, onRetry, onDismissError }) {
  if (!filePath) {
    return (
      <div className="fe-detail fe-detail--empty">
        <p>Select a file to see its details.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fe-detail">
        <h3 className="fe-detail-title">{filePath}</h3>
        <Skeleton variant="spinner" size={22} label="Loading file details…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fe-detail">
        <h3 className="fe-detail-title">{filePath}</h3>
        <Toast message={error} onDismiss={onDismissError} />
        <button type="button" className="fe-retry-btn" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (!detail) {
    return null;
  }

  const {
    language,
    size,
    imports = [],
    exports = [],
    functions = [],
    classes = [],
    content = '',
  } = detail;

  return (
    <div className="fe-detail">
      <div className="fe-detail-header">
        <h3 className="fe-detail-title">{filePath}</h3>
        <div className="fe-detail-meta">
          {language && (
            <span className="fe-lang-badge" style={{ '--lang-color': getLanguageColor(language) }}>
              <span className="fe-lang-dot" />
              {language}
            </span>
          )}
          {typeof size === 'number' && <span className="fe-badge">{formatBytes(size)}</span>}
        </div>
      </div>

      <div className="fe-cards-grid">
        <DetailCard icon={ArrowDownToLine} title="Imports" items={imports} accent="#38bdf8" />
        <DetailCard icon={ArrowUpFromLine} title="Exports" items={exports} accent="#fb7185" />
        <DetailCard
          icon={Code2}
          title="Functions"
          items={functions}
          accent="#2dd4bf"
          renderItem={(fn) => (
            <>
              <span className="fe-item-name">{fn.name}</span>
              <span className="fe-line-range">L{fn.startLine}-{fn.endLine}</span>
            </>
          )}
        />
        <DetailCard
          icon={Box}
          title="Classes"
          items={classes}
          accent="#a78bfa"
          renderItem={(cls) => (
            <>
              <span className="fe-item-name">{cls.name}</span>
              <span className="fe-line-range">L{cls.startLine}-{cls.endLine}</span>
            </>
          )}
        />
      </div>

      <PreviewSection content={content} language={language} />
    </div>
  );
}

export default function FileExplorer({ repoId }) {
  const [filePaths, setFilePaths] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);
  const [treeRetryToken, setTreeRetryToken] = useState(0);

  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedPath, setSelectedPath] = useState(null);

  const [fileDetail, setFileDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  useEffect(() => {
    if (!repoId) return;

    let cancelled = false;
    setTreeLoading(true);
    setTreeError(null);

    getGraph(repoId, 'dependency')
      .then(({ nodes }) => {
        if (cancelled) return;
        const uniquePaths = Array.from(
          new Set(
            (nodes || [])
              .map((node) => node.filePath)
              .filter((p) => typeof p === 'string' && p.length > 0)
          )
        ).sort();
        setFilePaths(uniquePaths);
      })
      .catch((err) => {
        if (cancelled) return;
        setTreeError(err?.data?.error || err.message || 'Failed to load file tree.');
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoId, treeRetryToken]);

  const tree = useMemo(() => buildTree(filePaths), [filePaths]);
  const topLevelNodes = useMemo(
    () =>
      Object.values(tree.children).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [tree]
  );

  const handleToggleDir = (path) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const fetchFileDetail = useCallback(
    (filePath) => {
      if (!repoId || !filePath) return;

      setFileDetail(null);
      setDetailError(null);
      setDetailLoading(true);

      getFileRecord(repoId, filePath)
        .then((data) => setFileDetail(data))
        .catch((err) => {
          setDetailError(err?.data?.error || err.message || 'Failed to load file details.');
        })
        .finally(() => setDetailLoading(false));
    },
    [repoId]
  );

  const handleSelectFile = (filePath) => {
    setSelectedPath(filePath);
    fetchFileDetail(filePath);
  };

  const handleRetryTree = () => setTreeRetryToken((t) => t + 1);
  const handleRetryDetail = () => fetchFileDetail(selectedPath);

  return (
    <div className="fe-container">
      <div className="fe-tree-panel">
        <h3 className="fe-tree-title">Files</h3>
        {treeLoading && <Skeleton variant="spinner" size={22} label="Loading files…" />}
        {treeError && (
          <div>
            <Toast message={treeError} onDismiss={() => setTreeError(null)} />
            <button type="button" className="fe-retry-btn" onClick={handleRetryTree}>
              Retry
            </button>
          </div>
        )}
        {!treeLoading && !treeError && topLevelNodes.length === 0 && (
          <p className="fe-detail-empty">No files found for this repository yet.</p>
        )}
        {!treeLoading && !treeError && topLevelNodes.length > 0 && (
          <ul className="fe-children fe-root">
            {topLevelNodes.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                depth={0}
                expandedDirs={expandedDirs}
                onToggleDir={handleToggleDir}
                selectedPath={selectedPath}
                onSelectFile={handleSelectFile}
              />
            ))}
          </ul>
        )}
      </div>

      <FileDetailPanel
        filePath={selectedPath}
        detail={fileDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={handleRetryDetail}
        onDismissError={() => setDetailError(null)}
      />
    </div>
  );
}