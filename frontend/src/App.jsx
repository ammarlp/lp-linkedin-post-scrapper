
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import {
  Search,
  Zap,
  SlidersHorizontal,
  X,
  Send,
  Download,
  Heart,
  MessageCircle,
  Repeat2,
  FilterX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Rocket,
  MessageSquareText,
  ThumbsUp,
  User,
} from 'lucide-react';

import { useSelection } from './hooks/useSelection';
import ResultsTable, { ProfileCell, ContentCell } from './components/ResultsTable';
import PersonalProfile from './components/PersonalProfile';

/* ─── Constants ─── */
const API_BASE = window.API_BASE_URL || '';

const STEPS = [
  'Tool Selection',
  'Advanced Filtering',
  'Sync to Launchpad',
];

const TOOL_OPTIONS = [
  { key: 'profile',  icon: Search,           label: 'Public Posts Scraper' },
  // { key: 'comment',  icon: MessageSquareText, label: 'Comment Scraper' },
  // { key: 'like',     icon: ThumbsUp,          label: 'Like Scraper' },
  { key: 'personal', icon: User,              label: 'My LinkedIn' },
];

/* ─── Normalisers ─── */
const normalizeItem = (item) => ({
  authorName: item.authorName || '',
  authorHeadline: item.authorHeadline || '',
  authorProfileUrl: item.authorProfileUrl || '',
  authorPicture: item.authorProfilePicture || '',
  authorType: item.authorType || '',
  postUrl: item.url || '',
  text: item.text || '',
  likes: parseInt(item.numLikes ?? item.likes) || 0,
  comments: parseInt(item.numComments ?? item.comments) || 0,
  reposts: parseInt(item.numShares ?? item.shares ?? item.reposts) || 0,
  postedAtISO: item.postedAtISO || '',
  timeSincePosted: item.timeSincePosted || '',
  isRepost: !!item.isRepost,
  id: item.url || `${item.authorName}::${(item.text || '').slice(0, 50)}`,
});

const normalizeScrapeItem = (item, index) => ({
  id: item.profileUrl || item.name || `profile-${index}`,
  name: item.name || '',
  headline: item.headline || '',
  profileUrl: item.profileUrl || '',
  picture: item.picture || '',
  reactionType: item.reactionType || 'LIKE',
  commentText: item.commentText || '',
  postedAt: item.postedAt || '',
  likes: parseInt(item.likes, 10) || 0,
});

/* ─── Helpers ─── */
const calcPercent = (num, denom) =>
  Math.round((num / Math.max(denom || 1, 1)) * 100);

const convertToCSV = (data) => {
  if (!data?.length) return '';
  const headers = ['URL', 'Author', 'Headline', 'Likes', 'Comments', 'Reposts', 'Text', 'Posted At'];
  const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
  const rows = data.map((p) => [
    p.postUrl, p.authorName, p.authorHeadline, p.likes, p.comments, p.reposts, esc(p.text), p.postedAtISO,
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
};

const downloadBlob = (content, filename, mime = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/* ─── Engagement metric pills ─── */
function MetricPills({ likes = 0, comments = 0, reposts = 0, reactionType }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {reactionType && (
        <span className="metric-pill likes" title="Reaction"><Heart size={12} /> {reactionType}</span>
      )}
      {!reactionType && likes > 0 && (
        <span className="metric-pill likes" title="Endorsements"><Heart size={12} /> {likes}</span>
      )}
      {comments > 0 && (
        <span className="metric-pill comments" title="Echoes"><MessageCircle size={12} /> {comments}</span>
      )}
      {reposts > 0 && (
        <span className="metric-pill reposts" title="Amplifications"><Repeat2 size={12} /> {reposts}</span>
      )}
    </div>
  );
}

/* ─── App ─── */
function App() {
  const [tool, setTool] = useState('profile');
  const [step, setStep] = useState(0);

  // Profile search
  const [keyword, setKeyword] = useState('');
  const [limit, setLimit] = useState(25);
  const [datePosted, setDatePosted] = useState('any');
  const [sortBy, setSortBy] = useState('relevance');

  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);

  // Engagement scrape
  const [scrapePostUrl, setScrapePostUrl] = useState('');
  const [scrapeKeywords, setScrapeKeywords] = useState('');
  const [scrapeLimit, setScrapeLimit] = useState(200);
  const [scrapeResults, setScrapeResults] = useState(null);
  const [scrapeJob, setScrapeJob] = useState(null);

  // Launchpad push
  const [lastPushSummary, setLastPushSummary] = useState(null);
  const [pushTags, setPushTags] = useState('');

  // Selection hooks
  const profileSel = useSelection();
  const scrapeSel = useSelection();

  const pollRef = useRef(null);

  // Filter states
  const [fIndustry, setFIndustry] = useState('');
  const [fAuthorName, setFAuthorName] = useState('');
  const [fJobTitle, setFJobTitle] = useState('');
  const [fPostText, setFPostText] = useState('');
  const [fHashtag, setFHashtag] = useState('');
  const [fAuthorType, setFAuthorType] = useState('any');
  const [fPostType, setFPostType] = useState('any');
  const [fMinLikes, setFMinLikes] = useState(0);
  const [fMinComments, setFMinComments] = useState(0);
  const [fMinReposts, setFMinReposts] = useState(0);
  const [fMinTotal, setFMinTotal] = useState(0);
  const [fPostedAfter, setFPostedAfter] = useState('');
  const [fPostedBefore, setFPostedBefore] = useState('');
  const [reportMonth, setReportMonth] = useState('');

  // Scrape result filters (comment + like tools)
  const [fScrapeName, setFScrapeName] = useState('');
  const [fScrapeHeadline, setFScrapeHeadline] = useState('');
  const [fScrapeCommentText, setFScrapeCommentText] = useState('');
  const [fScrapeReactionType, setFScrapeReactionType] = useState('any');

  // Cleanup poll on unmount
  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  // Reset on tool change
  useEffect(() => {
    setStatus(null);
    setResults(null);
    setScrapeResults(null);
    setScrapeJob(null);
    setLastPushSummary(null);
    profileSel.deselectAll();
    scrapeSel.deselectAll();
    setStep(0);
    setFScrapeName('');
    setFScrapeHeadline('');
    setFScrapeCommentText('');
    setFScrapeReactionType('any');
  }, [tool]);

  /* ─── API Helpers (generic POST) ─── */
  const apiPost = async (path, payload) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  /* ─── Profile Search ─── */
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!keyword) return;
    setStep(1);
    setStatus({ message: 'Initializing Launchpad Data Extractor. Scanning for signals...', type: 'info' });
    setResults(null);
    profileSel.deselectAll();

    try {
      const data = await apiPost('/api/search', { keyword, limit, datePosted, sortBy });
      const items = (data.items || []).map(normalizeItem);
      setResults(items);
      setStep(2);
      setStatus(items.length === 0
        ? { message: 'Zero signals detected. Calibrate parameters and try again.', type: 'info' }
        : { message: `Acquired ${items.length} targeting signals. Ready for CRM injection.`, type: 'success' },
      );
    } catch (err) {
      setStatus({ message: `Connectivity failure: ${err.message}`, type: 'error' });
    }
  };

  /* ─── Poll scrape job (shared between like & comment) ─── */
  const pollScrapeJob = async (jobId) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    try {
      const res = await fetch(`${API_BASE}/api/scrape/status/${jobId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch job');
      setScrapeJob(data);

      if (data.status === 'succeeded') {
        const normalized = (data.results || []).map(normalizeScrapeItem);
        setScrapeResults(normalized);
        scrapeSel.deselectAll();
        setStep(2);
        setStatus(normalized.length === 0
          ? { message: 'No profiles found. Try different keywords or post URL.', type: 'info' }
          : { message: `Extracted ${normalized.length} profiles.`, type: 'success' },
        );
        return;
      }
      if (data.status === 'failed') {
        setStatus({ message: `Scrape failed: ${data.error || 'unknown error'}`, type: 'error' });
        return;
      }
      pollRef.current = setTimeout(() => pollScrapeJob(jobId), 2500);
    } catch (err) {
      setStatus({ message: `Scrape status error: ${err.message}`, type: 'error' });
    }
  };

  // Generic engagement scrape launcher (DRY: covers like + keyword comment)
  const launchScrape = async (e, endpoint, label) => {
    e.preventDefault();
    if (!scrapePostUrl) return;
    setStep(1);
    setStatus({ message: `Launching ${label}. Tracking engagement...`, type: 'info' });
    setScrapeResults(null);
    scrapeSel.deselectAll();

    const payload = { postUrl: scrapePostUrl, limit: scrapeLimit };
    if (endpoint.includes('keywords')) {
      payload.keywords = scrapeKeywords.split(',').map((k) => k.trim()).filter(Boolean);
    }

    try {
      const data = await apiPost(`/api/scrape/${endpoint}`, payload);
      setScrapeJob({ id: data.jobId, status: data.status, type: data.type });
      pollScrapeJob(data.jobId);
    } catch (err) {
      setStatus({ message: `${label} error: ${err.message}`, type: 'error' });
    }
  };

  const handleStartLikeScrape = (e) => launchScrape(e, 'likes', 'Like Scraper');
  const handleStartKeywordScrape = (e) => launchScrape(e, 'comments/keywords', 'Comment Scraper');

  /* ─── Filtered results (profile tool only) ─── */
  const filteredResults = useMemo(() => {
    if (!results) return null;
    return results.filter((p) => {
      const match = (haystack, needle) => !needle || haystack.toLowerCase().includes(needle.toLowerCase());
      if (!match(`${p.authorHeadline} ${p.text}`, fIndustry)) return false;
      if (!match(p.authorName, fAuthorName)) return false;
      if (!match(p.authorHeadline, fJobTitle)) return false;
      if (!match(p.text, fPostText)) return false;
      const hash = fHashtag.trim().replace(/^#/, '');
      if (hash && !p.text.toLowerCase().includes('#' + hash.toLowerCase())) return false;
      if (fAuthorType === 'person' && p.authorType !== 'Person') return false;
      if (fAuthorType === 'company' && p.authorType !== 'Company') return false;
      if (fPostType === 'original' && p.isRepost) return false;
      if (fPostType === 'repost' && !p.isRepost) return false;
      if (p.likes < fMinLikes || p.comments < fMinComments || p.reposts < fMinReposts) return false;
      if (p.likes + p.comments + p.reposts < fMinTotal) return false;
      if (fPostedAfter && p.postedAtISO && new Date(p.postedAtISO) < new Date(fPostedAfter)) return false;
      if (fPostedBefore && p.postedAtISO && new Date(p.postedAtISO) > new Date(fPostedBefore)) return false;
      return true;
    });
  }, [results, fIndustry, fAuthorName, fJobTitle, fPostText, fHashtag, fAuthorType, fPostType, fMinLikes, fMinComments, fMinReposts, fMinTotal, fPostedAfter, fPostedBefore]);

  const clearFilters = () => {
    [setFIndustry, setFAuthorName, setFJobTitle, setFPostText, setFHashtag, setFPostedAfter, setFPostedBefore].forEach((fn) => fn(''));
    setFAuthorType('any');
    setFPostType('any');
    [setFMinLikes, setFMinComments, setFMinReposts, setFMinTotal].forEach((fn) => fn(0));
  };

  const filteredScrapeResults = useMemo(() => {
    if (!scrapeResults) return null;
    const match = (hay, needle) => !needle || (hay || '').toLowerCase().includes(needle.toLowerCase());
    return scrapeResults.filter((p) => {
      if (!match(p.name, fScrapeName)) return false;
      if (!match(p.headline, fScrapeHeadline)) return false;
      if (!match(p.commentText, fScrapeCommentText)) return false;
      if (fScrapeReactionType !== 'any' && p.reactionType !== fScrapeReactionType) return false;
      return true;
    });
  }, [scrapeResults, fScrapeName, fScrapeHeadline, fScrapeCommentText, fScrapeReactionType]);

  const clearScrapeFilters = () => {
    setFScrapeName('');
    setFScrapeHeadline('');
    setFScrapeCommentText('');
    setFScrapeReactionType('any');
  };

  /* ─── Launchpad Mappers ─── */
  const toLaunchpadPost = (profile) => ({
    authorName: profile.name || 'Unknown',
    authorHeadline: profile.headline || '',
    authorProfileUrl: profile.profileUrl || '',
    authorProfilePicture: profile.picture || '',
    postUrl: scrapePostUrl || '',
    text: profile.commentText ? `Comment: ${profile.commentText}` : 'Engaged with LinkedIn post',
    likes: profile.likes || 0,
    comments: 0,
    reposts: 0,
  });

  /* ─── Push to CRM ─── */
  const handlePushToCRM = async () => {
    // Map tool → { data, sel, mapper }
    const toolMap = {
      profile:  { data: filteredResults, sel: profileSel, mapper: null },
      like:     { data: scrapeResults,   sel: scrapeSel,  mapper: toLaunchpadPost },
      comment:  { data: scrapeResults,   sel: scrapeSel,  mapper: toLaunchpadPost },
    };
    const { data, sel, mapper } = toolMap[tool] || {};
    if (!data || sel.selectedIds.size === 0) return;

    let postsToPush = data.filter((p) => sel.selectedIds.has(p.id));
    if (mapper) postsToPush = postsToPush.map(mapper);

    setStatus({ message: `Pushing ${postsToPush.length} signals to Launchpad CRM...`, type: 'info' });
    const parsedTags = pushTags.split(',').map((t) => t.trim()).filter(Boolean);

    try {
      const pushData = await apiPost('/api/launchpad/push', { posts: postsToPush, tags: parsedTags });
      setStatus({
        message: `Launchpad injection complete. ${pushData.created} inserted, ${pushData.existing} merged.`,
        type: 'success',
      });
      setLastPushSummary(pushData);
      setStep(3);
      profileSel.deselectAll();
      scrapeSel.deselectAll();
    } catch (err) {
      setStatus({ message: `Launchpad CRM Error: ${err.message}`, type: 'error' });
    }
  };

  /* ─── PDF & CSV Export ─── */
  const handleExportPDF = () => {
    if (!filteredResults) return;
    const data = profileSel.selectedIds.size > 0
      ? filteredResults.filter((p) => profileSel.selectedIds.has(p.id))
      : filteredResults;
    if (!data.length) return;

    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(16);
    doc.text('Launchpad Engine - Acquired Signals', 20, y); y += 10;
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y); y += 15;

    data.forEach((p, i) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(12); doc.setTextColor(238, 86, 34);
      doc.text(`${i + 1}. ${p.authorName} - ${p.authorHeadline}`.substring(0, 80), 20, y); y += 6;
      doc.setFontSize(10); doc.setTextColor(50, 50, 50);
      doc.text(`Likes: ${p.likes} | Comments: ${p.comments} | Reposts: ${p.reposts}`, 20, y); y += 6;
      if (p.postUrl) { doc.text(`URL: ${p.postUrl}`, 20, y); y += 6; }
      const lines = doc.splitTextToSize(p.text || '(No content)', 170);
      for (const line of lines) {
        if (y > 280) { doc.addPage(); y = 20; doc.setFontSize(10); doc.setTextColor(50, 50, 50); }
        doc.text(line, 20, y); y += 5;
      }
      y += 10;
    });
    doc.save(`Launchpad-Signals-${reportMonth || 'Export'}.pdf`);
  };

  const handleExportCSV = (onlySelected) => {
    if (!filteredResults) return;
    const data = onlySelected ? filteredResults.filter((p) => profileSel.selectedIds.has(p.id)) : filteredResults;
    downloadBlob(convertToCSV(data), `Launchpad-${onlySelected ? 'Selected' : 'All'}.csv`);
  };

  /* ─── Derived values ─── */
  const successPercent = lastPushSummary
    ? calcPercent(lastPushSummary.created + lastPushSummary.existing, lastPushSummary.total)
    : 0;
  const currentSelectionCount =
    tool === 'profile' ? profileSel.selectedIds.size
    : tool === 'personal' ? 0
    : scrapeSel.selectedIds.size;

  /* ─── Column configs for ResultsTable ─── */
  const profileColumns = [
    {
      header: 'Profile',
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
      header: 'Content',
      render: (p) => <ContentCell text={p.text} linkUrl={p.postUrl} />,
    },
    {
      header: 'Engagement',
      render: (p) => <MetricPills likes={p.likes} comments={p.comments} reposts={p.reposts} />,
    },
  ];

  const scrapeColumns = [
    {
      header: 'Profile',
      render: (p) => (
        <ProfileCell
          name={p.name}
          headline={p.headline}
          profileUrl={p.profileUrl}
          picture={p.picture}
          timestamp={p.postedAt}
        />
      ),
    },
    {
      header: 'Engagement Detail',
      render: (p) => <ContentCell text={p.commentText || 'Reaction captured'} linkUrl={scrapePostUrl} linkLabel="[Review Post]" />,
    },
    {
      header: 'Signal',
      render: (p) => <MetricPills reactionType={p.reactionType} likes={p.likes} />,
    },
  ];

  /* ─── JSX ─── */
  return (
    <div className="app-container">
      {/* Header */}
      <header className="brand-header">
        <div>
          <div className="brand-logo-text flex items-center gap-2">
            <Rocket className="text-launchpad-accent" size={32} />
            LAUNCHPAD
          </div>
          <div className="brand-subtitle font-heading">
            Proprietary Lead Aggregation Engine
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Custom tag (e.g. VIP)"
            className="bento-input"
            style={{ width: '150px', padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
            value={pushTags}
            onChange={(e) => setPushTags(e.target.value)}
          />
          {tool !== 'personal' && (
            <button
              className="bento-btn bento-btn-primary"
              disabled={currentSelectionCount === 0}
              onClick={handlePushToCRM}
            >
              <Send size={16} /> Add to Launchpad
            </button>
          )}
          {tool === 'personal' && (
            <div style={{ fontSize: '0.75rem', color: 'var(--launchpad-text-muted)', fontStyle: 'italic' }}>
              Use sync buttons within each section
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--launchpad-success)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--launchpad-success)' }} />
            Systems Online
          </div>
        </div>
      </header>

      {/* Tool Tabs */}
      <nav className="tool-tabs">
        {TOOL_OPTIONS.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            type="button"
            className={`tool-tab ${tool === key ? 'active' : ''}`}
            onClick={() => setTool(key)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </nav>

      {/* Main Grid */}
      <div className="bento-dashboard">

        {/* Personal Profile — full-width, replaces sidebar+main */}
        {tool === 'personal' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <PersonalProfile apiPost={apiPost} pushTags={pushTags} />
          </div>
        )}

        {/* Sidebar */}
        <aside style={{ display: tool === 'personal' ? 'none' : 'flex', flexDirection: 'column', gap: 'var(--bento-gap)' }}>
          {/* Profile Parameters */}
          {tool === 'profile' && (
            <div className="bento-panel">
              <h2 className="panel-title"><Zap size={14} /> Engagement Parameters</h2>
              <form id="search-form" onSubmit={handleSearch}>
                <div className="input-group">
                  <label className="input-label">Keyword / Signal</label>
                  <input type="text" required placeholder='"AI startup", #hiring' className="bento-input" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Time Range</label>
                  <select className="bento-input bento-select" value={datePosted} onChange={(e) => setDatePosted(e.target.value)}>
                    <option value="any">All Time</option>
                    <option value="past-24h">Last 24 Hours</option>
                    <option value="past-week">Last 7 Days</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Results Limit</label>
                  <input type="number" min="1" max="50" className="bento-input" value={limit} onChange={(e) => setLimit(parseInt(e.target.value) || 25)} />
                </div>
                <button type="submit" className="bento-btn bento-btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={status?.type === 'info'}>
                  <Search size={16} />
                  <span>{status?.type === 'info' ? 'Scanning...' : 'Start Scrapping'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Engagement Parameters */}
          {(tool === 'like' || tool === 'comment') && (
            <div className="bento-panel">
              <h2 className="panel-title"><Zap size={14} /> Engagement Parameters</h2>
              <form onSubmit={tool === 'like' ? handleStartLikeScrape : handleStartKeywordScrape}>
                <div className="input-group">
                  <label className="input-label">LinkedIn Post URL</label>
                  <input type="text" required placeholder="https://www.linkedin.com/posts/..." className="bento-input" value={scrapePostUrl} onChange={(e) => setScrapePostUrl(e.target.value)} />
                </div>
                {tool === 'comment' && (
                  <div className="input-group">
                    <label className="input-label">Keywords (comma separated)</label>
                    <input type="text" placeholder="hiring, open to work, ai" className="bento-input" value={scrapeKeywords} onChange={(e) => setScrapeKeywords(e.target.value)} />
                  </div>
                )}
                <div className="input-group">
                  <label className="input-label">Profiles Limit</label>
                  <input type="number" min="1" max="500" className="bento-input" value={scrapeLimit} onChange={(e) => setScrapeLimit(parseInt(e.target.value) || 100)} />
                </div>
                <button type="submit" className="bento-btn bento-btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={status?.type === 'info'}>
                  <Search size={16} />
                  <span>{status?.type === 'info' ? 'Running...' : 'Start Scrape'}</span>
                </button>
              </form>
            </div>
          )}

          {/* Filters Sidebar (comment + like tools) */}
          {(tool === 'comment' || tool === 'like') && scrapeResults && (
            <div className="bento-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <SlidersHorizontal size={14} color="var(--launchpad-accent)" />
                <h2 style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--launchpad-text-secondary)', margin: 0 }}>
                  Refine Results
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <FilterSection title="Profile">
                  <FilterInput label="Name contains" placeholder="e.g. John" value={fScrapeName} onChange={setFScrapeName} />
                  <FilterInput label="Headline contains" placeholder="e.g. CEO, SaaS" value={fScrapeHeadline} onChange={setFScrapeHeadline} />
                </FilterSection>
                {tool === 'comment' && (
                  <FilterSection title="Comment">
                    <FilterInput label="Comment text contains" placeholder="e.g. hiring, AI" value={fScrapeCommentText} onChange={setFScrapeCommentText} />
                  </FilterSection>
                )}
                {tool === 'like' && (
                  <FilterSection title="Reaction">
                    <div>
                      <label className="input-label">Reaction type</label>
                      <select className="bento-input bento-select" value={fScrapeReactionType} onChange={(e) => setFScrapeReactionType(e.target.value)}>
                        <option value="any">All reactions</option>
                        <option value="LIKE">Like</option>
                        <option value="PRAISE">Praise</option>
                        <option value="EMPATHY">Empathy</option>
                        <option value="APPRECIATION">Appreciation</option>
                        <option value="INTEREST">Interest</option>
                      </select>
                    </div>
                  </FilterSection>
                )}
                <button type="button" className="bento-btn bento-btn-secondary" style={{ width: '100%' }} onClick={clearScrapeFilters}>
                  <X size={16} /> Clear filters
                </button>
              </div>
            </div>
          )}

          {/* Filters Sidebar (profile tool) */}
          {tool === 'profile' && results && (
            <div className="bento-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <SlidersHorizontal size={14} color="var(--launchpad-accent)" />
                <h2 style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--launchpad-text-secondary)', margin: 0 }}>
                  Refine results
                </h2>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--launchpad-text-muted)', margin: '-0.75rem 0 1rem 0' }}>Instant. No extra cost.</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Text filters */}
                <FilterSection title="Text">
                  <FilterInput label="Industry / keywords" placeholder="e.g. SaaS, Healthcare" value={fIndustry} onChange={setFIndustry} />
                  <FilterInput label="Author name contains" placeholder="e.g. John" value={fAuthorName} onChange={setFAuthorName} />
                  <FilterInput label="Headline contains" placeholder="e.g. CEO, SaaS" value={fJobTitle} onChange={setFJobTitle} />
                  <FilterInput label="Post text contains" placeholder="e.g. fundraise" value={fPostText} onChange={setFPostText} />
                  <FilterInput label="Contains hashtag" placeholder="e.g. #hiring" value={fHashtag} onChange={setFHashtag} />
                </FilterSection>

                {/* Type filters */}
                <FilterSection title="Type">
                  <div>
                    <label className="input-label">Author is</label>
                    <select className="bento-input bento-select" value={fAuthorType} onChange={(e) => setFAuthorType(e.target.value)}>
                      <option value="any">Anyone</option>
                      <option value="person">People only</option>
                      <option value="company">Companies only</option>
                    </select>
                  </div>
                  <div>
                    <label className="input-label">Post is</label>
                    <select className="bento-input bento-select" value={fPostType} onChange={(e) => setFPostType(e.target.value)}>
                      <option value="any">Original + reposts</option>
                      <option value="original">Original only</option>
                      <option value="repost">Reposts only</option>
                    </select>
                  </div>
                </FilterSection>

                {/* Engagement filters */}
                <FilterSection title="Engagement">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <FilterInput label="Min likes" type="number" min="0" value={fMinLikes} onChange={(v) => setFMinLikes(parseInt(v) || 0)} />
                    <FilterInput label="Min comments" type="number" min="0" value={fMinComments} onChange={(v) => setFMinComments(parseInt(v) || 0)} />
                    <FilterInput label="Min reposts" type="number" min="0" value={fMinReposts} onChange={(v) => setFMinReposts(parseInt(v) || 0)} />
                    <FilterInput label="Min total" type="number" min="0" value={fMinTotal} onChange={(v) => setFMinTotal(parseInt(v) || 0)} />
                  </div>
                </FilterSection>

                {/* Date filters */}
                <FilterSection title="Date">
                  <FilterInput label="Posted on or after" type="date" value={fPostedAfter} onChange={setFPostedAfter} />
                  <FilterInput label="Posted on or before" type="date" value={fPostedBefore} onChange={setFPostedBefore} />
                </FilterSection>

                <button type="button" className="bento-btn bento-btn-secondary" style={{ width: '100%', marginTop: '0.5rem' }} onClick={clearFilters}>
                  <X size={16} /> Clear all filters
                </button>
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main style={{ display: tool === 'personal' ? 'none' : undefined }}>
          {/* Wizard progress */}
          <div className="wizard">
            {STEPS.map((label, idx) => (
              <div key={label} className={`wizard-step ${idx === step ? 'active' : ''} ${idx < step ? 'done' : ''}`}>
                <span className="wizard-index">{idx + 1}</span>
                <span className="wizard-label">{label}</span>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div className="progress-grid" style={{ gridTemplateColumns: '1fr' }}>
            <ProgressCard label="CRM Sync" percent={successPercent} className="success" />
          </div>

          {/* Status */}
          {status && (
            <div className={`status-box status-${status.type}`}>
              {status.type === 'info' && <Loader2 size={18} className="spinner" />}
              {status.type === 'error' && <AlertCircle size={18} />}
              {status.type === 'success' && <CheckCircle2 size={18} />}
              {status.message}
            </div>
          )}

          {/* Standby */}
          {!results && !filteredScrapeResults && !status && (
            <div className="bento-panel" style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <Search size={48} color="var(--launchpad-border)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ color: 'var(--launchpad-text-secondary)', marginBottom: '0.5rem' }}>System Standby</h3>
              <p style={{ color: 'var(--launchpad-text-muted)', fontSize: '0.875rem', maxWidth: '300px' }}>
                Enter mission parameters to the left to intercept and aggregate public entity signals.
              </p>
            </div>
          )}

          {/* Profile Results */}
          {tool === 'profile' && filteredResults && (
            <ResultsTable
              title="Mission Results"
              subtitle={`${filteredResults.length} signals pass current tuning.`}
              items={filteredResults}
              selectedIds={profileSel.selectedIds}
              onToggle={profileSel.toggle}
              onSelectAll={profileSel.handleSelectAll(filteredResults)}
              columns={profileColumns}
              emptyText="No signals matched your tuning."
              actions={
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="month" className="bento-input" style={{ width: 'auto', padding: '0.375rem 0.75rem' }} value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} />
                    <button className="bento-btn bento-btn-secondary" onClick={handleExportPDF}><Download size={16} /> Monthly PDF</button>
                  </div>
                  <button className="bento-btn bento-btn-secondary" disabled={profileSel.selectedIds.size === 0} onClick={() => handleExportCSV(true)}><Download size={16} /> Export selected</button>
                  <button className="bento-btn bento-btn-secondary" onClick={() => handleExportCSV(false)}><Download size={16} /> Export all</button>
                </>
              }
            />
          )}

          {/* Engagement (scrape) Results */}
          {(tool === 'like' || tool === 'comment') && filteredScrapeResults && (
            <ResultsTable
              title="Engagement Results"
              subtitle={`${filteredScrapeResults.length} of ${scrapeResults.length} profiles.`}
              items={filteredScrapeResults}
              selectedIds={scrapeSel.selectedIds}
              onToggle={scrapeSel.toggle}
              onSelectAll={scrapeSel.handleSelectAll(filteredScrapeResults)}
              columns={scrapeColumns}
              emptyText="No profiles matched your filters."
            />
          )}

        </main>
      </div>
    </div>
  );
}

/* ─── Sub-components (DRY: extracted repeated patterns) ─── */

function FilterSection({ title, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h3 style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--launchpad-text-muted)', margin: 0 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function FilterInput({ label, value, onChange, ...rest }) {
  return (
    <div>
      <label className="input-label">{label}</label>
      <input
        className="bento-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...rest}
      />
    </div>
  );
}

function ProgressCard({ label, percent, className }) {
  return (
    <div className="progress-card">
      <div className="progress-meta">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="progress-track">
        <div className={`progress-fill ${className}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default App;
