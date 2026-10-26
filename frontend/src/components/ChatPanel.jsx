// frontend/src/components/ChatPanel.jsx
import { useEffect, useRef, useState } from 'react';
import { Bot, User, ChevronDown, ChevronRight, FileCode2, SendHorizontal } from 'lucide-react';
import { askQuestion } from '../api/client.js';
import Alert from './Alert.jsx';

function NodeChip({ nodeId, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(nodeId)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: '3px 10px',
        fontSize: 'var(--font-xs)',
        borderRadius: 'var(--radius-pill)',
        border: '1px solid var(--color-accent-border)',
        background: 'var(--color-accent-bg)',
        color: 'var(--color-accent-text)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: `background var(--transition-fast), transform var(--transition-fast)`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 113, 227, 0.16)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--color-accent-bg)';
      }}
      title={`Highlight ${nodeId} in graph`}
    >
      <FileCode2 size={11} strokeWidth={2} />
      {nodeId}
    </button>
  );
}

function ReferencedFiles({ nodeIds, onChipClick }) {
  const [open, setOpen] = useState(false);

  if (!nodeIds || nodeIds.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 'var(--space-3)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 'var(--space-2)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-1)',
          background: 'none',
          border: 'none',
          padding: '2px 0',
          borderRadius: 0,
          color: 'var(--color-text-muted)',
          fontSize: 'var(--font-xs)',
          fontWeight: 600,
          letterSpacing: '0.01em',
          cursor: 'pointer',
        }}
      >
        {open ? <ChevronDown size={13} strokeWidth={2} /> : <ChevronRight size={13} strokeWidth={2} />}
        Referenced files ({nodeIds.length})
      </button>

      {open && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-2)',
          }}
        >
          {nodeIds.map((nodeId) => (
            <NodeChip key={nodeId} nodeId={nodeId} onClick={onChipClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ role }) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 'var(--radius-md)',
        flexShrink: 0,
        background: isUser ? 'var(--color-primary)' : 'var(--color-surface-alt)',
        border: isUser ? 'none' : '1px solid var(--color-border-strong)',
        color: isUser ? 'var(--color-primary-text)' : 'var(--color-accent-text)',
      }}
    >
      {isUser ? <User size={13} strokeWidth={2.2} /> : <Bot size={13} strokeWidth={2.2} />}
    </div>
  );
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatPanel({ repoId, onNodeHighlight }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFailedQuestion, setLastFailedQuestion] = useState(null);
  const [inputFocused, setInputFocused] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuestion = async (question) => {
    if (!question || loading || !repoId) return;

    setError(null);
    setLastFailedQuestion(null);
    setLoading(true);

    try {
      const result = await askQuestion(repoId, question);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.answer,
          relevantNodes: result.relevantNodes || [],
          id: `a-${Date.now()}`,
          ts: Date.now(),
        },
      ]);
    } catch (err) {
      setError(err?.data?.error || err.message || 'Failed to get an answer.');
      setLastFailedQuestion(question);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    const question = input.trim();
    if (!question || loading || !repoId) return;

    setMessages((prev) => [...prev, { role: 'user', text: question, id: `u-${Date.now()}`, ts: Date.now() }]);
    setInput('');
    sendQuestion(question);
  };

  const handleRetry = () => {
    if (lastFailedQuestion) sendQuestion(lastFailedQuestion);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (nodeId) => {
    if (typeof onNodeHighlight === 'function') {
      onNodeHighlight(nodeId);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
      }}
    >
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        {messages.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-md)' }}>
            Ask a question about this repository's architecture.
          </p>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 'var(--space-2)',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}
            >
              <Avatar role={msg.role} />

              <div
                style={{
                  background: isUser ? 'var(--color-accent-bg)' : 'var(--color-surface-alt)',
                  border: isUser ? '1px solid var(--color-accent-border)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: 'var(--space-3) var(--space-4)',
                  boxShadow: 'var(--shadow-sm)',
                  minWidth: 0,
                }}
              >
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-md)', color: 'var(--color-text)', lineHeight: 1.5 }}>
                  {msg.text}
                </div>

                {msg.ts && (
                  <div
                    style={{
                      marginTop: 'var(--space-2)',
                      fontSize: 'var(--font-xs)',
                      color: 'var(--color-text-muted)',
                      textAlign: isUser ? 'right' : 'left',
                    }}
                  >
                    {formatTime(msg.ts)}
                  </div>
                )}

                {msg.role === 'assistant' && (
                  <ReferencedFiles nodeIds={msg.relevantNodes} onChipClick={handleChipClick} />
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', alignSelf: 'flex-start' }}>
            <Avatar role="assistant" />
            <div
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--font-md)',
                fontStyle: 'italic',
                background: 'var(--color-surface-alt)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-2) var(--space-4)',
              }}
            >
              thinking...
            </div>
          </div>
        )}

        {error && (
          <Alert
            message={error}
            onRetry={lastFailedQuestion ? handleRetry : undefined}
            onDismiss={() => setError(null)}
          />
        )}

        <div ref={bottomRef} />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 'var(--space-2)',
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          placeholder="Ask about this codebase..."
          rows={1}
          disabled={!repoId || loading}
          style={{
            flex: 1,
            resize: 'none',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${inputFocused ? 'var(--color-accent)' : 'var(--color-border-strong)'}`,
            background: 'var(--color-bg-subtle)',
            color: 'var(--color-text)',
            fontSize: 'var(--font-md)',
            fontFamily: 'var(--font-family)',
            outline: 'none',
            boxShadow: inputFocused ? '0 0 0 3px rgba(0, 113, 227, 0.18)' : 'none',
            transition: `border-color var(--transition-fast), box-shadow var(--transition-fast)`,
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!repoId || loading || !input.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-3) var(--space-5)',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            background: 'var(--color-primary)',
            color: 'var(--color-primary-text)',
            fontSize: 'var(--font-md)',
            fontWeight: 600,
            cursor: !repoId || loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: !repoId || loading || !input.trim() ? 0.5 : 1,
            transition: `opacity var(--transition-fast), transform var(--transition-fast), background var(--transition-fast)`,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) e.currentTarget.style.background = 'var(--color-accent-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--color-primary)';
          }}
        >
          <SendHorizontal size={15} strokeWidth={2.2} />
          Send
        </button>
      </div>
    </div>
  );
}
