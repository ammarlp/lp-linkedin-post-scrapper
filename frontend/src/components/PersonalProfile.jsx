import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  User,
  Users,
  Newspaper,
  MessageSquare,
  Eye,
  EyeOff,
  Link2,
  Unlink,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  X,
  ExternalLink,
  Clock,
  MapPin,
  Building2,
  Lock,
} from 'lucide-react';
import ResultsTable, { ProfileCell, ContentCell } from './ResultsTable.jsx';
import { useSelection } from '../hooks/useSelection.js';

const API_BASE = window.API_BASE_URL || '';

/* ─── Helpers ─── */
function StatusBox({ status }) {
  if (!status) return null;
  return (
    <div className={`status-box status-${status.type}`}>
      {status.type === 'info' && <Loader2 size={18} className="spinner" />}
      {status.type === 'error' && <AlertCircle size={18} />}
      {status.type === 'success' && <CheckCircle2 size={18} />}
      {status.message}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--launchpad-text-primary)', margin: 0 }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: '0.75rem', color: 'var(--launchpad-text-muted)', marginTop: '0.25rem', marginBottom: 0 }}>
          {description}
        </p>
      )}
    </div>
  );
}

/* ─── Cookie Connection Panel ─── */
function CookiePanel({ cookie, onCookieChange, isConnected, onConnect, onDisconnect }) {
  const [showCookie, setShowCookie] = useState(false);
  const [saveCookie, setSaveCookie] = useState(!!localStorage.getItem('li_at_cookie'));

  const [missingJsession, setMissingJsession] = useState(false);

  const handleConnect = () => {
    if (!cookie.trim()) return;
    // Warn if the user pasted only a plain token instead of the full JSON array
    let hasJsession = false;
    if (cookie.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(cookie.trim());
        hasJsession = parsed.some((c) => c.name === 'JSESSIONID' || c.name === 'jsessionid');
      } catch { /* ignore */ }
    }
    setMissingJsession(!hasJsession);
    if (saveCookie) {
      localStorage.setItem('li_at_cookie', cookie.trim());
    } else {
      localStorage.removeItem('li_at_cookie');
    }
    onConnect();
  };

  const handleDisconnect = () => {
    localStorage.removeItem('li_at_cookie');
    onDisconnect();
  };

  return (
    <div className="bento-panel">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 160 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: isConnected ? 'var(--launchpad-success)' : 'var(--launchpad-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <User size={20} color={isConnected ? '#fff' : 'var(--launchpad-text-muted)'} />
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--launchpad-text-primary)' }}>
              LinkedIn Session
            </div>
            <div style={{ fontSize: '0.7rem', color: isConnected ? 'var(--launchpad-success)' : 'var(--launchpad-text-muted)' }}>
              {isConnected ? 'Connected' : 'Not connected'}
            </div>
          </div>
        </div>

        {/* Input area */}
        {!isConnected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1, minWidth: 280 }}>
            <div>
              <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Lock size={11} />
                LinkedIn Cookies (JSON from Copy Cookies extension)
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  className="bento-input"
                  placeholder='Paste the JSON array from the "Copy Cookies" extension…'
                  value={cookie}
                  onChange={(e) => onCookieChange(e.target.value)}
                  rows={3}
                  style={{ paddingRight: '2.5rem', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.7rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCookie((v) => !v)}
                  style={{
                    position: 'absolute', right: '0.6rem', top: '0.6rem',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--launchpad-text-muted)', padding: 0,
                  }}
                  title={showCookie ? 'Hide' : 'Show'}
                >
                  {showCookie ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="save-cookie"
                className="bento-checkbox"
                checked={saveCookie}
                onChange={(e) => setSaveCookie(e.target.checked)}
              />
              <label htmlFor="save-cookie" style={{ fontSize: '0.75rem', color: 'var(--launchpad-text-secondary)', cursor: 'pointer' }}>
                Remember in this browser (stored in localStorage)
              </label>
            </div>

            <div style={{
              padding: '0.625rem 0.875rem',
              background: 'rgba(var(--launchpad-warning-rgb, 255,165,0), 0.08)',
              border: '1px solid rgba(255,165,0,0.25)',
              borderRadius: 'var(--bento-radius)',
              fontSize: '0.7rem',
              color: 'var(--launchpad-text-muted)',
              lineHeight: 1.5,
            }}>
              <strong>How to get your cookies:</strong> Install the <strong>Copy Cookies</strong> Chrome extension → log into LinkedIn → click the extension icon on linkedin.com (it copies all cookies to your clipboard as JSON) → paste here.<br /><br />
              <strong>Important:</strong> You need the full JSON array (not just the <code>li_at</code> value) — the <code>JSESSIONID</code> cookie inside it is required for authentication. Your cookies are sensitive — treat them like a password and never share them.
            </div>

            <button
              type="button"
              className="bento-btn bento-btn-primary"
              style={{ alignSelf: 'flex-start' }}
              disabled={!cookie.trim()}
              onClick={handleConnect}
            >
              <Link2 size={15} /> Connect Account
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                padding: '0.375rem 0.875rem',
                background: 'rgba(var(--launchpad-success-rgb,34,197,94),0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 'var(--bento-radius)',
                fontSize: '0.75rem',
                color: 'var(--launchpad-success)',
                fontFamily: 'monospace',
              }}>
                {cookie.trim().startsWith('[')
                  ? `[cookies JSON · ${(() => { try { return JSON.parse(cookie).length; } catch { return '?'; } })()} entries]`
                  : `••••••••••••${cookie.slice(-6)}`}
              </div>
              <button
                type="button"
                className="bento-btn bento-btn-secondary"
                onClick={handleDisconnect}
              >
                <Unlink size={14} /> Disconnect
              </button>
            </div>
            {missingJsession && (
              <div style={{
                padding: '0.5rem 0.75rem',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 'var(--bento-radius)',
                fontSize: '0.7rem',
                color: '#ef4444',
              }}>
                Warning: <code>JSESSIONID</code> cookie not found. API calls may fail. Make sure you pasted the full JSON array from the Copy Cookies extension (not just the <code>li_at</code> value).
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Connections Tab ─── */
function ConnectionsTab({ cookie, apiPost, pushTags, onSessionInvalidated }) {
  const [limit, setLimit] = useState(100);
  const [connections, setConnections] = useState(null);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);
  const sel = useSelection();

  // Filter states
  const [fName, setFName] = useState('');
  const [fHeadline, setFHeadline] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fCompany, setFCompany] = useState('');

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const poll = async (jobId) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      const res = await fetch(`${API_BASE}/api/personal/connections-status/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      if (data.status === 'succeeded') {
        const items = (data.results || []).map((c, i) => ({
          ...c,
          id: c.profileUrl || `conn-${i}`,
        }));
        setConnections(items);
        sel.deselectAll();
        setStatus({ message: `Found ${items.length} connections. Note: your LinkedIn session may now be invalidated — re-enter cookies before using other tabs.`, type: 'success' });
        onSessionInvalidated?.();
        return;
      }
      if (data.status === 'failed') {
        setStatus({ message: `Failed: ${data.error || 'unknown error'}`, type: 'error' });
        return;
      }
      pollRef.current = setTimeout(() => poll(jobId), 2500);
    } catch (err) {
      setStatus({ message: `Poll error: ${err.message}`, type: 'error' });
    }
  };

  const handleFetch = async () => {
    setStatus({ message: 'Fetching your LinkedIn connections…', type: 'info' });
    setConnections(null);
    sel.deselectAll();
    try {
      const data = await apiPost('/api/personal/connections', { cookie, limit });
      poll(data.jobId);
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  const handleSync = async () => {
    const selected = filtered.filter((c) => sel.selectedIds.has(c.id));
    if (!selected.length) return;
    setStatus({ message: `Syncing ${selected.length} connections to Launchpad…`, type: 'info' });
    const parsedTags = (pushTags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const posts = selected.map((c) => ({
      authorName: c.name,
      authorHeadline: c.headline,
      authorProfileUrl: c.profileUrl,
      authorProfilePicture: c.picture,
      postUrl: c.profileUrl,
      text: [
        c.connectedAt ? `Connected since: ${c.connectedAt}` : '',
        c.location ? `Location: ${c.location}` : '',
        c.company ? `Company: ${c.company}` : '',
      ].filter(Boolean).join(' | ') || 'LinkedIn Connection',
      likes: 0, comments: 0, reposts: 0,
    }));
    try {
      const result = await apiPost('/api/launchpad/push', { posts, tags: parsedTags });
      setStatus({ message: `Synced! ${result.created} created, ${result.existing} already in CRM.`, type: 'success' });
      sel.deselectAll();
    } catch (err) {
      setStatus({ message: `Sync error: ${err.message}`, type: 'error' });
    }
  };

  const filtered = useMemo(() => {
    if (!connections) return [];
    const match = (hay, needle) => !needle || (hay || '').toLowerCase().includes(needle.toLowerCase());
    return connections.filter((c) =>
      match(c.name, fName) &&
      match(c.headline, fHeadline) &&
      match(c.location, fLocation) &&
      match(c.company, fCompany)
    );
  }, [connections, fName, fHeadline, fLocation, fCompany]);

  const columns = [
    {
      header: 'Connection',
      render: (c) => (
        <ProfileCell
          name={c.name}
          headline={c.headline}
          profileUrl={c.profileUrl}
          picture={c.picture}
          timestamp={c.connectedAt}
        />
      ),
    },
    {
      header: 'Location',
      render: (c) => (
        <div style={{ fontSize: '0.8125rem', color: 'var(--launchpad-text-secondary)' }}>
          {c.location && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={11} style={{ opacity: 0.6 }} />
              {c.location}
            </span>
          )}
          {c.company && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.2rem' }}>
              <Building2 size={11} style={{ opacity: 0.6 }} />
              {c.company}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 'var(--bento-gap)' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
        <div className="bento-panel">
          <h2 className="panel-title"><Users size={14} /> Fetch Parameters</h2>

          {/* Logout warning */}
          <div style={{
            padding: '0.625rem 0.75rem',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.35)',
            borderRadius: 'var(--bento-radius)',
            marginBottom: '0.75rem',
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'flex-start',
          }}>
            <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <div style={{ fontSize: '0.7rem', color: '#ef4444', lineHeight: 1.5 }}>
              <strong>Warning:</strong> Fetching connections may log you out of LinkedIn in your browser. Use at your own risk.
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Max Connections</label>
            <input
              type="number" min="1" max="500" className="bento-input"
              value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
            />
          </div>
          <button
            type="button"
            className="bento-btn bento-btn-primary"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={status?.type === 'info'}
            onClick={handleFetch}
          >
            {status?.type === 'info' ? <><Loader2 size={15} className="spinner" /> Fetching…</> : <><Users size={15} /> Fetch Connections</>}
          </button>
        </div>

        {connections && (
          <div className="bento-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <SlidersHorizontal size={14} color="var(--launchpad-accent)" />
              <h2 style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--launchpad-text-secondary)', margin: 0 }}>
                Filter
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[
                { label: 'Name', val: fName, set: setFName, placeholder: 'e.g. John' },
                { label: 'Headline', val: fHeadline, set: setFHeadline, placeholder: 'e.g. CEO' },
                { label: 'Location', val: fLocation, set: setFLocation, placeholder: 'e.g. London' },
                { label: 'Company', val: fCompany, set: setFCompany, placeholder: 'e.g. Google' },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <label className="input-label">{label}</label>
                  <input className="bento-input" value={val} placeholder={placeholder} onChange={(e) => set(e.target.value)} />
                </div>
              ))}
              <button
                type="button"
                className="bento-btn bento-btn-secondary"
                style={{ width: '100%' }}
                onClick={() => { setFName(''); setFHeadline(''); setFLocation(''); setFCompany(''); }}
              >
                <X size={14} /> Clear filters
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
        <StatusBox status={status} />

        {!connections && !status && (
          <div className="bento-panel" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
            <Users size={40} color="var(--launchpad-border)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: 'var(--launchpad-text-secondary)', marginBottom: '0.5rem' }}>Your Connections</h3>
            <p style={{ color: 'var(--launchpad-text-muted)', fontSize: '0.875rem', maxWidth: 300 }}>
              Set a limit and click "Fetch Connections" to load your LinkedIn network.
            </p>
          </div>
        )}

        {connections && (
          <ResultsTable
            title="My Connections"
            subtitle={`${filtered.length} of ${connections.length} connections`}
            items={filtered}
            selectedIds={sel.selectedIds}
            onToggle={sel.toggle}
            onSelectAll={sel.handleSelectAll(filtered)}
            columns={columns}
            emptyText="No connections matched your filters."
            actions={
              <button
                className="bento-btn bento-btn-primary"
                disabled={sel.selectedIds.size === 0 || status?.type === 'info'}
                onClick={handleSync}
              >
                <Send size={15} /> Sync {sel.selectedIds.size > 0 ? `${sel.selectedIds.size} ` : ''}to Launchpad
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

/* ─── Connection Posts Tab ─── */
function ConnectionPostsTab({ cookie, apiPost, pushTags }) {
  const [limit, setLimit] = useState(25);
  const [keyword, setKeyword] = useState('');
  const [posts, setPosts] = useState(null);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);
  const sel = useSelection();

  // Filter states
  const [fAuthor, setFAuthor] = useState('');
  const [fText, setFText] = useState('');
  const [fMinLikes, setFMinLikes] = useState(0);
  const [fMinComments, setFMinComments] = useState(0);
  const [fAuthorType, setFAuthorType] = useState('any');

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const poll = async (jobId) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      const res = await fetch(`${API_BASE}/api/personal/posts-status/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      if (data.status === 'succeeded') {
        const items = (data.results || []).map((p, i) => ({
          ...p,
          id: p.postUrl || `post-${i}`,
          likes: p.numLikes || 0,
          comments: p.numComments || 0,
          reposts: p.numShares || 0,
          authorPicture: p.authorProfilePicture || '',
          postUrl: p.postUrl || '',
        }));
        setPosts(items);
        sel.deselectAll();
        setStatus({ message: `Loaded ${items.length} posts from your connections' feed.`, type: 'success' });
        return;
      }
      if (data.status === 'failed') {
        setStatus({ message: `Failed: ${data.error || 'unknown error'}`, type: 'error' });
        return;
      }
      pollRef.current = setTimeout(() => poll(jobId), 2500);
    } catch (err) {
      setStatus({ message: `Poll error: ${err.message}`, type: 'error' });
    }
  };

  const handleFetch = async () => {
    setStatus({ message: "Fetching posts from your connections' feed\u2026", type: 'info' });
    setPosts(null);
    sel.deselectAll();
    try {
      const data = await apiPost('/api/personal/posts', { cookie, keyword, limit });
      poll(data.jobId);
    } catch (err) {
      setStatus({ message: `Error: ${err.message}`, type: 'error' });
    }
  };

  const handleSync = async () => {
    const selected = filtered.filter((p) => sel.selectedIds.has(p.id));
    if (!selected.length) return;
    setStatus({ message: `Syncing ${selected.length} post authors to Launchpad…`, type: 'info' });
    const parsedTags = (pushTags || '').split(',').map((t) => t.trim()).filter(Boolean);
    const payload = selected.map((p) => ({
      authorName: p.authorName,
      authorHeadline: p.authorHeadline,
      authorProfileUrl: p.authorProfileUrl,
      authorProfilePicture: p.authorPicture,
      postUrl: p.postUrl,
      text: p.text,
      likes: p.likes,
      comments: p.comments,
      reposts: p.reposts,
    }));
    try {
      const result = await apiPost('/api/launchpad/push', { posts: payload, tags: parsedTags });
      setStatus({ message: `Synced! ${result.created} created, ${result.existing} already in CRM.`, type: 'success' });
      sel.deselectAll();
    } catch (err) {
      setStatus({ message: `Sync error: ${err.message}`, type: 'error' });
    }
  };

  const filtered = useMemo(() => {
    if (!posts) return [];
    const match = (hay, needle) => !needle || (hay || '').toLowerCase().includes(needle.toLowerCase());
    return posts.filter((p) => {
      if (!match(p.authorName, fAuthor)) return false;
      if (!match(p.text, fText)) return false;
      if (p.likes < fMinLikes) return false;
      if (p.comments < fMinComments) return false;
      if (fAuthorType === 'person' && p.authorType !== 'Person') return false;
      if (fAuthorType === 'company' && p.authorType !== 'Company') return false;
      return true;
    });
  }, [posts, fAuthor, fText, fMinLikes, fMinComments, fAuthorType]);

  const columns = [
    {
      header: 'Author',
      render: (p) => (
        <ProfileCell
          name={p.authorName}
          headline={p.authorHeadline}
          profileUrl={p.authorProfileUrl}
          picture={p.authorPicture}
          timestamp={p.timeSincePosted}
        />
      ),
    },
    {
      header: 'Post',
      render: (p) => <ContentCell text={p.text} linkUrl={p.postUrl} linkLabel="[View Post]" />,
    },
    {
      header: 'Engagement',
      render: (p) => (
        <div style={{ fontSize: '0.8rem', color: 'var(--launchpad-text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          {p.likes > 0 && <span>❤ {p.likes.toLocaleString()}</span>}
          {p.comments > 0 && <span>💬 {p.comments.toLocaleString()}</span>}
          {p.reposts > 0 && <span>🔁 {p.reposts.toLocaleString()}</span>}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 'var(--bento-gap)' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
        <div className="bento-panel">
          <h2 className="panel-title"><Newspaper size={14} /> Fetch Parameters</h2>
          <div className="input-group">
            <label className="input-label">Keyword (optional)</label>
            <input
              type="text" className="bento-input" placeholder="Filter posts by keyword"
              value={keyword} onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label className="input-label">Max Posts</label>
            <input
              type="number" min="1" max="100" className="bento-input"
              value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 25)}
            />
          </div>
          <button
            type="button"
            className="bento-btn bento-btn-primary"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={status?.type === 'info'}
            onClick={handleFetch}
          >
            {status?.type === 'info' ? <><Loader2 size={15} className="spinner" /> Fetching…</> : <><Newspaper size={15} /> Fetch Feed</>}
          </button>
        </div>

        {posts && (
          <div className="bento-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <SlidersHorizontal size={14} color="var(--launchpad-accent)" />
              <h2 style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--launchpad-text-secondary)', margin: 0 }}>
                Filter
              </h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label className="input-label">Author type</label>
                <select className="bento-input bento-select" value={fAuthorType} onChange={(e) => setFAuthorType(e.target.value)}>
                  <option value="any">People & Companies</option>
                  <option value="person">People only</option>
                  <option value="company">Companies only</option>
                </select>
              </div>
              <div>
                <label className="input-label">Author name</label>
                <input className="bento-input" value={fAuthor} placeholder="e.g. Jane" onChange={(e) => setFAuthor(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Post text contains</label>
                <input className="bento-input" value={fText} placeholder="e.g. hiring" onChange={(e) => setFText(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="input-label">Min likes</label>
                  <input type="number" min="0" className="bento-input" value={fMinLikes} onChange={(e) => setFMinLikes(parseInt(e.target.value) || 0)} />
                </div>
                <div>
                  <label className="input-label">Min comments</label>
                  <input type="number" min="0" className="bento-input" value={fMinComments} onChange={(e) => setFMinComments(parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <button
                type="button"
                className="bento-btn bento-btn-secondary"
                style={{ width: '100%' }}
                onClick={() => { setFAuthor(''); setFText(''); setFMinLikes(0); setFMinComments(0); setFAuthorType('any'); }}
              >
                <X size={14} /> Clear filters
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
        <StatusBox status={status} />

        {!posts && !status && (
          <div className="bento-panel" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
            <Newspaper size={40} color="var(--launchpad-border)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: 'var(--launchpad-text-secondary)', marginBottom: '0.5rem' }}>Connection Feed</h3>
            <p style={{ color: 'var(--launchpad-text-muted)', fontSize: '0.875rem', maxWidth: 300 }}>
              Fetch recent posts from your LinkedIn connections, then filter and sync authors to Launchpad.
            </p>
          </div>
        )}

        {posts && (
          <ResultsTable
            title="Connection Feed"
            subtitle={`${filtered.length} of ${posts.length} posts`}
            items={filtered}
            selectedIds={sel.selectedIds}
            onToggle={sel.toggle}
            onSelectAll={sel.handleSelectAll(filtered)}
            columns={columns}
            emptyText="No posts matched your filters."
            actions={
              <button
                className="bento-btn bento-btn-primary"
                disabled={sel.selectedIds.size === 0 || status?.type === 'info'}
                onClick={handleSync}
              >
                <Send size={15} /> Sync {sel.selectedIds.size > 0 ? `${sel.selectedIds.size} ` : ''}to Launchpad
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

/* ─── Messages Tab ─── */
function MessagesTab({ cookie, apiPost }) {
  const [limit, setLimit] = useState(50);
  const [conversations, setConversations] = useState(null);
  const [status, setStatus] = useState(null);
  const pollRef = useRef(null);
  const sel = useSelection();

  const [notConfigured, setNotConfigured] = useState(false);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const poll = async (jobId) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      const res = await fetch(`${API_BASE}/api/personal/messages-status/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      if (data.status === 'succeeded') {
        const items = (data.results || []).map((m, i) => ({
          ...m,
          id: m.conversationId || `msg-${i}`,
        }));
        setConversations(items);
        sel.deselectAll();
        setStatus({ message: `Loaded ${items.length} conversations.`, type: 'success' });
        return;
      }
      if (data.status === 'failed') {
        setStatus({ message: `Failed: ${data.error || 'unknown error'}`, type: 'error' });
        return;
      }
      pollRef.current = setTimeout(() => poll(jobId), 2500);
    } catch (err) {
      setStatus({ message: `Poll error: ${err.message}`, type: 'error' });
    }
  };

  const handleFetch = async () => {
    setNotConfigured(false);
    setStatus({ message: 'Fetching your LinkedIn conversations…', type: 'info' });
    setConversations(null);
    try {
      const data = await apiPost('/api/personal/messages', { cookie, limit });
      poll(data.jobId);
    } catch (err) {
      if (err.message.includes('not configured') || err.message.includes('501')) {
        setNotConfigured(true);
        setStatus(null);
      } else {
        setStatus({ message: `Error: ${err.message}`, type: 'error' });
      }
    }
  };

  const columns = [
    {
      header: 'Participant',
      render: (m) => (
        <ProfileCell
          name={m.participantName}
          headline={m.participantHeadline}
          profileUrl={m.participantProfileUrl}
          picture={m.participantPicture}
        />
      ),
    },
    {
      header: 'Last Message',
      render: (m) => (
        <ContentCell
          text={m.lastMessage}
          linkUrl={m.participantProfileUrl}
          linkLabel="[View Profile]"
        />
      ),
    },
    {
      header: 'Time',
      render: (m) => (
        <div style={{ fontSize: '0.8rem', color: 'var(--launchpad-text-muted)' }}>
          {m.lastMessageAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={11} />
              {m.lastMessageAt}
            </span>
          )}
          {m.unreadCount > 0 && (
            <span style={{
              display: 'inline-block', marginTop: '0.25rem',
              padding: '0 0.375rem', background: 'var(--launchpad-accent)',
              color: '#fff', borderRadius: '999px', fontSize: '0.7rem',
            }}>
              {m.unreadCount} unread
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 'var(--bento-gap)' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, flexShrink: 0 }}>
        <div className="bento-panel">
          <h2 className="panel-title"><MessageSquare size={14} /> Fetch Parameters</h2>
          <div className="input-group">
            <label className="input-label">Max Conversations</label>
            <input
              type="number" min="1" max="200" className="bento-input"
              value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 50)}
            />
          </div>
          <button
            type="button"
            className="bento-btn bento-btn-primary"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={status?.type === 'info'}
            onClick={handleFetch}
          >
            {status?.type === 'info' ? <><Loader2 size={15} className="spinner" /> Fetching…</> : <><MessageSquare size={15} /> Fetch Messages</>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
        <StatusBox status={status} />

        {notConfigured && (
          <div className="bento-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
            <MessageSquare size={48} color="var(--launchpad-border)" style={{ margin: '0 auto 1rem' }} />
            <h3 style={{ color: 'var(--launchpad-text-primary)', marginBottom: '0.5rem' }}>
              Messages Scraper Not Configured
            </h3>
            <p style={{ color: 'var(--launchpad-text-muted)', fontSize: '0.875rem', maxWidth: 420, margin: '0 auto 1rem' }}>
              To enable message fetching, set <code style={{ background: 'var(--launchpad-border)', padding: '0.1rem 0.3rem', borderRadius: 3 }}>APIFY_MESSAGES_ACTOR</code> in your <code>.env.local</code> file to a compatible LinkedIn messages Apify actor (e.g., <code>data_link_miner~linkedin-messages-scraper</code>).
            </p>
          </div>
        )}

        {!conversations && !status && !notConfigured && (
          <div className="bento-panel" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', textAlign: 'center' }}>
            <MessageSquare size={40} color="var(--launchpad-border)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ color: 'var(--launchpad-text-secondary)', marginBottom: '0.5rem' }}>Your Conversations</h3>
            <p style={{ color: 'var(--launchpad-text-muted)', fontSize: '0.875rem', maxWidth: 300 }}>
              Fetch your recent LinkedIn conversations. Requires <code>APIFY_MESSAGES_ACTOR</code> to be configured.
            </p>
          </div>
        )}

        {conversations && (
          <ResultsTable
            title="Conversations"
            subtitle={`${conversations.length} conversations`}
            items={conversations}
            selectedIds={sel.selectedIds}
            onToggle={sel.toggle}
            onSelectAll={sel.handleSelectAll(conversations)}
            columns={columns}
            emptyText="No conversations found."
          />
        )}
      </div>
    </div>
  );
}

/* ─── Invalidated Session Banner ─── */
function InvalidatedSessionBanner({ onReconnect }) {
  return (
    <div style={{
      padding: '1.25rem 1.5rem',
      background: 'rgba(239,68,68,0.07)',
      border: '1px solid rgba(239,68,68,0.35)',
      borderRadius: 'var(--bento-radius)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
    }}>
      <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '0.1rem' }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#ef4444', marginBottom: '0.25rem' }}>
          Session Invalidated
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--launchpad-text-secondary)', margin: '0 0 0.75rem' }}>
          Your LinkedIn session cookie was invalidated when connections were fetched. You need to copy fresh cookies from your browser and reconnect before using this feature.
        </p>
        <button type="button" className="bento-btn bento-btn-primary" onClick={onReconnect}>
          <Link2 size={14} /> Re-enter Cookies
        </button>
      </div>
    </div>
  );
}

/* ─── Main PersonalProfile Component ─── */
export default function PersonalProfile({ apiPost, pushTags }) {
  const [cookie, setCookie] = useState(() => localStorage.getItem('li_at_cookie') || '');
  const [isConnected, setIsConnected] = useState(() => !!localStorage.getItem('li_at_cookie'));
  const [activeTab, setActiveTab] = useState('connections');
  const [sessionInvalidated, setSessionInvalidated] = useState(false);

  const TABS = [
    { key: 'connections', label: 'Connections', Icon: Users },
    { key: 'posts', label: 'Connection Posts', Icon: Newspaper },
    // { key: 'messages', label: 'Messages', Icon: MessageSquare },
  ];

  const handleConnect = () => {
    setIsConnected(true);
    setSessionInvalidated(false);
  };

  const handleDisconnect = () => {
    setCookie('');
    setIsConnected(false);
    setSessionInvalidated(false);
  };

  // Called by ConnectionsTab after a successful fetch — session is now likely invalidated
  const handleSessionInvalidated = () => setSessionInvalidated(true);

  // Prompt user to reconnect — disconnect so CookiePanel shows the input again
  const handleReconnect = () => {
    localStorage.removeItem('li_at_cookie');
    setCookie('');
    setIsConnected(false);
    setSessionInvalidated(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
      {/* Cookie panel */}
      <CookiePanel
        cookie={cookie}
        onCookieChange={setCookie}
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Tabs + content */}
      {isConnected && (
        <>
          {/* Sub-tab nav */}
          <nav style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid var(--launchpad-border)', paddingBottom: 0 }}>
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                  padding: '0.625rem 1rem',
                  fontSize: '0.8125rem', fontWeight: activeTab === key ? 700 : 500,
                  color: activeTab === key ? 'var(--launchpad-accent)' : 'var(--launchpad-text-secondary)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === key ? '2px solid var(--launchpad-accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 0.15s',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>

          {/* Tab content */}
          <div>
            {activeTab === 'connections' && (
              <ConnectionsTab cookie={cookie} apiPost={apiPost} pushTags={pushTags} onSessionInvalidated={handleSessionInvalidated} />
            )}
            {activeTab === 'posts' && (
              sessionInvalidated
                ? <InvalidatedSessionBanner onReconnect={handleReconnect} />
                : <ConnectionPostsTab cookie={cookie} apiPost={apiPost} pushTags={pushTags} />
            )}
            {activeTab === 'messages' && (
              sessionInvalidated
                ? <InvalidatedSessionBanner onReconnect={handleReconnect} />
                : <MessagesTab cookie={cookie} apiPost={apiPost} />
            )}
          </div>
        </>
      )}

      {!isConnected && (
        <div className="bento-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <User size={48} color="var(--launchpad-border)" style={{ margin: '0 auto 1rem' }} />
          <h3 style={{ color: 'var(--launchpad-text-secondary)', marginBottom: '0.5rem' }}>Connect Your Account</h3>
          <p style={{ color: 'var(--launchpad-text-muted)', fontSize: '0.875rem', maxWidth: 360, margin: '0 auto' }}>
            Paste your LinkedIn <code>li_at</code> session cookie above to view your connections, feed, and messages — and sync contacts to Launchpad.
          </p>
        </div>
      )}
    </div>
  );
}
