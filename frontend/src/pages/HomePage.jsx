import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRepo } from '../api/client.js';

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    if (!repoUrl.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const { repoId } = await createRepo(repoUrl.trim());
      navigate(`/repo/${repoId}`);
    } catch (err) {
      setError(err.message || 'Failed to create repo');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: 420,
          padding: 32,
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <h1 style={{ fontSize: 18, margin: 0 }}>Codebase Memory</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
          Paste a GitHub repo URL to build its dependency and call graph.
        </p>

        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          style={{
            padding: '10px 12px',
            fontSize: 14,
            borderRadius: 6,
            border: '1px solid #d1d5db',
          }}
        />

        {error && <span style={{ fontSize: 12, color: '#b91c1c' }}>{error}</span>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '10px 12px',
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 6,
            border: 'none',
            background: submitting ? '#9ca3af' : '#111827',
            color: '#fff',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Creating…' : 'Analyze repo'}
        </button>
      </form>
    </div>
  );
}
