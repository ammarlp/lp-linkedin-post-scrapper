import React, { useState } from 'react';
import { ExternalLink, Clock, FilterX } from 'lucide-react';

/**
 * Shared results table component used by Profile, Engagement, and Personal tools.
 * Accepts a column configuration to handle the varying columns per tool.
 *
 * @param {Object} props
 * @param {string}   props.title       - Panel header title
 * @param {string}   props.subtitle    - Description line below title
 * @param {Array}    props.items       - The data rows to render
 * @param {Set}      props.selectedIds - Currently selected IDs
 * @param {Function} props.onToggle    - Called with (id) when a row checkbox toggles
 * @param {Function} props.onSelectAll - Called with the checkbox event
 * @param {Array}    props.columns     - Array of { header, render(item) } objects
 * @param {React.ReactNode} [props.actions] - Optional extra buttons in the header bar
 * @param {string}   [props.emptyText] - Text shown when no items match
 */
export default function ResultsTable({
  title,
  subtitle,
  items,
  selectedIds,
  onToggle,
  onSelectAll,
  columns,
  actions = null,
  emptyText = 'No data matched your query.',
}) {
  return (
    <div className="bento-panel" style={{ padding: '0', overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--launchpad-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h2
            className="panel-title"
            style={{ margin: 0, color: 'var(--launchpad-text-primary)' }}
          >
            {title}
          </h2>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--launchpad-text-muted)',
              marginTop: '0.25rem',
            }}
          >
            {subtitle}
          </div>
        </div>
        {actions && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>{actions}</div>}
      </div>

      {/* Body */}
      {items.length === 0 ? (
        <div
          style={{
            padding: '4rem',
            textAlign: 'center',
            color: 'var(--launchpad-text-muted)',
          }}
        >
          <FilterX
            size={32}
            style={{ margin: '0 auto 1rem', opacity: 0.5 }}
          />
          <p>{emptyText}</p>
        </div>
      ) : (
        <div
          className="table-wrapper"
          style={{ border: 'none', borderRadius: 0 }}
        >
          <table className="bento-table">
            <thead>
              <tr>
                <th style={{ width: '40px', paddingLeft: '1.5rem' }}>
                  <input
                    type="checkbox"
                    className="bento-checkbox"
                    onChange={onSelectAll}
                    checked={
                      selectedIds.size === items.length && items.length > 0
                    }
                  />
                </th>
                {columns.map((col) => (
                  <th key={col.header}>{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={selectedIds.has(item.id) ? 'selected' : ''}
                >
                  <td style={{ paddingLeft: '1.5rem' }}>
                    <input
                      type="checkbox"
                      className="bento-checkbox"
                      onChange={() => onToggle(item.id)}
                      checked={selectedIds.has(item.id)}
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.header}>{col.render(item)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
 * Shared cell renderers — reusable across tools
 * ───────────────────────────────────────────── */

/**
 * Renders author/profile identity cell (avatar + name + headline + optional timestamp).
 */
export function ProfileCell({ name, headline, profileUrl, picture, timestamp }) {
  return (
    <div className="author-cell">
      {picture ? (
        <img src={picture} alt="Profile" className="author-avatar" />
      ) : (
        <div className="author-fallback">{name?.charAt(0) || '?'}</div>
      )}
      <div className="author-info">
        <a
          href={profileUrl || '#'}
          target="_blank"
          rel="noreferrer"
          className="author-name"
          style={{ textDecoration: 'none' }}
        >
          {name || 'Unknown'}{' '}
          <ExternalLink size={10} style={{ opacity: 0.5 }} />
        </a>
        <span className="author-headline" title={headline}>
          {headline}
        </span>
        {timestamp && (
          <span
            style={{
              fontSize: '10px',
              color: 'var(--launchpad-text-muted)',
              marginTop: '2px',
            }}
          >
            <Clock
              size={10}
              style={{
                display: 'inline',
                verticalAlign: 'middle',
                marginRight: '2px',
              }}
            />{' '}
            {timestamp}
          </span>
        )}
      </div>
    </div>
  );
}

const TRUNCATE_AT = 180;

/**
 * Renders a text content cell with truncation and a "Read more" toggle.
 */
export function ContentCell({ text, linkUrl, linkLabel = '[View Post]' }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text && text.length > TRUNCATE_AT;
  const displayed = needsTruncation && !expanded ? text.slice(0, TRUNCATE_AT).trimEnd() + '…' : text;

  return (
    <div
      className="card-text"
      style={{
        fontSize: '0.8125rem',
        color: 'var(--launchpad-text-secondary)',
        lineHeight: 1.6,
        maxWidth: '340px',
      }}
    >
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{displayed}</span>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: 'inline',
            marginLeft: '0.25rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--launchpad-accent)',
            fontSize: '0.75rem',
            fontWeight: 600,
            padding: 0,
          }}
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
      {linkUrl && (
        <a
          href={linkUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block',
            marginTop: '0.375rem',
            color: 'var(--launchpad-accent)',
            textDecoration: 'none',
            fontSize: '0.75rem',
          }}
        >
          {linkLabel} <ExternalLink size={10} style={{ verticalAlign: 'middle' }} />
        </a>
      )}
    </div>
  );
}
