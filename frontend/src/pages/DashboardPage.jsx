import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRepos, createRepo, deleteRepo } from '../api/client.js';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import './DashboardPage.css';

const STATUS_CLASS = {
  pending: 'status-badge--pending',
  cloning: 'status-badge--cloning',
  parsing: 'status-badge--parsing',
  ready: 'status-badge--ready',
  failed: 'status-badge--failed',
};

function StatusBadge({ status }) {
  const statusClass = STATUS_CLASS[status] || STATUS_CLASS.pending;
  return <span className={`status-badge ${statusClass}`}>{status}</span>;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-8 0 1 13a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);

  const navigate = useNavigate();

  const loadRepos = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const data = await getRepos();
      setRepos(Array.isArray(data) ? data : []);
    } catch (err) {
      setListError(err.message || 'Failed to load repos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!repoUrl.trim()) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const { repoId } = await createRepo(repoUrl.trim());
      navigate(`/repo/${repoId}`);
    } catch (err) {
      setFormError(err.message || 'Failed to create repo');
    } finally {
      setSubmitting(false);
    }
  }

  function requestDelete(event, repoId) {
    event.stopPropagation();
    setPendingDeleteId(repoId);
  }

  async function confirmDelete() {
    const repoId = pendingDeleteId;
    setPendingDeleteId(null);
    setDeletingId(repoId);
    setDeleteError(null);

    try {
      await deleteRepo(repoId);
      setRepos((prev) => prev.filter((r) => r._id !== repoId));
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete repo');
    } finally {
      setDeletingId(null);
    }
  }

  function cancelDelete() {
    setPendingDeleteId(null);
  }

  return (
    <div className="dashboard">
      <div className="dashboard__inner">
        <div className="dashboard__header">
          <div>
            <h1 className="dashboard__title">Codebase Memory</h1>
            <p className="dashboard__subtitle">// previously analyzed repositories</p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className={`dashboard__new-btn ${showForm ? 'dashboard__new-btn--cancel' : ''}`}
          >
            {showForm ? 'cancel' : '+ analyze_repo'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="dashboard__form">
            <p className="dashboard__form-hint">
              // paste a GitHub repo URL to build its dependency and call graph
            </p>

            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              autoFocus
              className="dashboard__input"
            />

            {formError && <span className="dashboard__form-error">{formError}</span>}

            <button type="submit" disabled={submitting} className="dashboard__submit-btn">
              {submitting ? 'creating…' : '$ analyze'}
            </button>
          </form>
        )}

        {loading && <p className="dashboard__status-text">// loading repos…</p>}

        {!loading && listError && (
          <p className="dashboard__status-text dashboard__status-text--error">{listError}</p>
        )}

        {deleteError && (
          <p className="dashboard__status-text dashboard__status-text--error">{deleteError}</p>
        )}

        {!loading && !listError && repos.length === 0 && (
          <p className="dashboard__status-text">
            // no repos analyzed yet — click "+ analyze_repo" to get started
          </p>
        )}

        {!loading && !listError && repos.length > 0 && (
          <div className="dashboard__grid">
            {repos.map((repo) => (
              <div
                key={repo._id}
                onClick={() => navigate(`/repo/${repo._id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/repo/${repo._id}`);
                }}
                className="repo-card"
              >
                <div className="repo-card__name">{repo.name || repo.repoUrl}</div>
                <StatusBadge status={repo.status} />
                <div className="repo-card__date">{formatDate(repo.createdAt)}</div>

                <button
                  type="button"
                  onClick={(e) => requestDelete(e, repo._id)}
                  disabled={deletingId === repo._id}
                  className="repo-card__trash-btn"
                  aria-label="Delete repo"
                  title="Delete repo"
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this repo?"
        message="This can't be undone. All parsed files and graph data will be removed."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}