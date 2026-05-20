const form = document.getElementById('search-form');
const searchBtn = document.getElementById('search-btn');
const statusEl = document.getElementById('status');
const emptyState = document.getElementById('empty-state');
const toolbar = document.getElementById('results-toolbar');
const grid = document.getElementById('results-grid');
const noMatches = document.getElementById('no-matches');
const countEl = document.getElementById('count');
const filterSummary = document.getElementById('filter-summary');
const downloadSelectedBtn = document.getElementById('download-selected-btn');
const downloadAllBtn = document.getElementById('download-all-btn');
const pushGhlBtn = document.getElementById('push-ghl-btn');
const selectAllCheckbox = document.getElementById('select-all');
const selectedCountEl = document.getElementById('selected-count');
const clientFilters = document.getElementById('client-filters');
const clearFiltersBtn = document.getElementById('clear-filters');

const fAuthorName = document.getElementById('filter-author-name');
const fJobTitle = document.getElementById('filter-job-title');
const fPostText = document.getElementById('filter-post-text');
const fHashtag = document.getElementById('filter-hashtag');
const fIndustry = document.getElementById('filter-industry');
const fAuthorType = document.getElementById('filter-author-type');
const fPostType = document.getElementById('filter-post-type');
const fMinLikes = document.getElementById('filter-min-likes');
const fMinComments = document.getElementById('filter-min-comments');
const fMinReposts = document.getElementById('filter-min-reposts');
const fMinTotal = document.getElementById('filter-min-total');
const fPostedAfter = document.getElementById('filter-posted-after');
const fPostedBefore = document.getElementById('filter-posted-before');
const reportMonthInput = document.getElementById('report-month');
const downloadPdfBtn = document.getElementById('download-pdf-btn');

let allResults = [];
let filteredResults = [];
let currentKeyword = '';
const selectedIds = new Set();

const API_BASE = window.API_BASE_URL || '';
const apiFetch = (path, options) => fetch(`${API_BASE}${path}`, options);

function postId(p) {
  return p.postUrl || `${p.authorName}::${p.text.slice(0, 50)}`;
}

function setStatus(message, type = 'info') {
  if (!message) {
    statusEl.classList.add('hidden');
    return;
  }
  const styles = {
    info:    { bg: 'bg-brand-500/10', border: 'border-brand-500/30', text: 'text-brand-700', icon: 'loader-2', spin: true },
    error:   { bg: 'bg-red-500/10',   border: 'border-red-500/30',   text: 'text-red-700',   icon: 'alert-circle', spin: false },
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-700', icon: 'check-circle-2', spin: false },
  };
  const s = styles[type];
  statusEl.className = `mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2.5 border ${s.bg} ${s.border} ${s.text}`;
  statusEl.innerHTML = `<i data-lucide="${s.icon}" class="w-4 h-4 flex-shrink-0 ${s.spin ? 'spinner' : ''}"></i><span>${escapeHtml(message)}</span>`;
  statusEl.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (Array.isArray(v)) return v.length;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

function normalize(item) {
  return {
    authorName: item.authorName || '',
    authorHeadline: item.authorHeadline || '',
    authorProfileUrl: item.authorProfileUrl || '',
    authorPicture: item.authorProfilePicture || '',
    authorType: item.authorType || '',
    postUrl: item.url || '',
    text: item.text || '',
    email: item.email || item.workEmail || item.personalEmail || item.authorEmail || '',
    phone: item.phone || item.phoneNumber || item.mobilePhone || item.authorPhone || '',
    likes: toNumber(item.numLikes ?? item.likes),
    comments: toNumber(item.numComments ?? item.comments),
    reposts: toNumber(item.numShares ?? item.shares ?? item.reposts),
    postedAtISO: item.postedAtISO || '',
    timeSincePosted: item.timeSincePosted || '',
    isRepost: !!item.isRepost,
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

function renderCard(p) {
  const id = postId(p);
  const isSelected = selectedIds.has(id);
  const fallbackInitials = `<div class=\\'w-11 h-11 rounded-full font-semibold flex items-center justify-center flex-shrink-0\\' style=\\'background:rgba(238,86,34,0.15);color:#f37a4c;border:1px solid rgba(238,86,34,0.3);\\'>${escapeHtml(initials(p.authorName))}</div>`;
  const avatar = p.authorPicture
    ? `<img src="${escapeHtml(p.authorPicture)}" alt="" class="w-11 h-11 rounded-full object-cover flex-shrink-0 border border-ink-700" onerror="this.outerHTML='${fallbackInitials}'" />`
    : `<div class="w-11 h-11 rounded-full bg-brand-500/15 text-brand-400 font-semibold flex items-center justify-center flex-shrink-0 border border-brand-500/30">${escapeHtml(initials(p.authorName))}</div>`;

  const repostBadge = p.isRepost
    ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-ink-900 border border-ink-700 text-[10px] text-ink-400 font-medium">
         <i data-lucide="repeat-2" class="w-2.5 h-2.5"></i>Repost
       </span>`
    : '';

  return `
    <article data-id="${escapeHtml(id)}" class="post-card fade-in relative ${isSelected ? 'selected' : ''}">
      <label class="absolute top-3 right-3 z-10 cursor-pointer">
        <input type="checkbox" class="card-checkbox checkbox" ${isSelected ? 'checked' : ''} />
      </label>
      <div class="p-4 pr-12 flex items-start gap-3 border-b border-ink-700">
        ${avatar}
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              ${p.authorProfileUrl
                ? `<a href="${escapeHtml(p.authorProfileUrl)}" target="_blank" rel="noopener" class="font-semibold text-ink-50 hover:text-brand-400 truncate block transition-colors">${escapeHtml(p.authorName || 'Unknown')}</a>`
                : `<div class="font-semibold text-ink-50 truncate">${escapeHtml(p.authorName || 'Unknown')}</div>`}
              <div class="text-xs text-ink-400 truncate mt-0.5" title="${escapeHtml(p.authorHeadline)}">${escapeHtml(p.authorHeadline)}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-1.5">
            ${p.timeSincePosted ? `<span class="text-[11px] text-ink-500 flex items-center gap-1"><i data-lucide="clock" class="w-2.5 h-2.5"></i>${escapeHtml(p.timeSincePosted)}</span>` : ''}
            ${repostBadge}
          </div>
        </div>
      </div>

      <div class="px-4 py-3.5 flex-1">
        <p class="text-sm text-ink-200 whitespace-pre-wrap card-text leading-relaxed">${escapeHtml(p.text)}</p>
      </div>

      <div class="px-4 py-3 border-t border-ink-700 flex items-center justify-between gap-2 bg-ink-900/40">
        <div class="flex items-center gap-3.5 text-xs text-ink-300">
          <span title="Likes" class="flex items-center gap-1">
            <i data-lucide="heart" class="w-3.5 h-3.5 text-brand-500"></i>
            <span class="font-medium">${formatNumber(p.likes)}</span>
          </span>
          <span title="Comments" class="flex items-center gap-1">
            <i data-lucide="message-circle" class="w-3.5 h-3.5 text-ink-400"></i>
            <span class="font-medium">${formatNumber(p.comments)}</span>
          </span>
          <span title="Reposts" class="flex items-center gap-1">
            <i data-lucide="repeat-2" class="w-3.5 h-3.5 text-ink-400"></i>
            <span class="font-medium">${formatNumber(p.reposts)}</span>
          </span>
        </div>
        ${p.postUrl
          ? `<a href="${escapeHtml(p.postUrl)}" target="_blank" rel="noopener" class="text-xs font-semibold text-brand-400 hover:text-brand-500 whitespace-nowrap flex items-center gap-1 transition-colors">
               View <i data-lucide="external-link" class="w-3 h-3"></i>
             </a>`
          : ''}
      </div>
    </article>
  `;
}

function applyFilters() {
  const industry = fIndustry.value.trim().toLowerCase();
  const authorName = fAuthorName.value.trim().toLowerCase();
  const jobTitle = fJobTitle.value.trim().toLowerCase();
  const postText = fPostText.value.trim().toLowerCase();
  const hashtag = fHashtag.value.trim().toLowerCase().replace(/^#/, '');
  const authorType = fAuthorType.value;
  const postType = fPostType.value;
  const minLikes = parseInt(fMinLikes.value, 10) || 0;
  const minComments = parseInt(fMinComments.value, 10) || 0;
  const minReposts = parseInt(fMinReposts.value, 10) || 0;
  const minTotal = parseInt(fMinTotal.value, 10) || 0;
  const postedAfter = fPostedAfter.value ? new Date(fPostedAfter.value).getTime() : 0;
  const postedBefore = fPostedBefore.value ? new Date(fPostedBefore.value).getTime() : 0;

  filteredResults = allResults.filter((p) => {
    if (industry) {
      const hay = `${p.authorHeadline} ${p.text}`.toLowerCase();
      if (!hay.includes(industry)) return false;
    }
    if (authorName && !p.authorName.toLowerCase().includes(authorName)) return false;
    if (jobTitle && !p.authorHeadline.toLowerCase().includes(jobTitle)) return false;
    if (postText && !p.text.toLowerCase().includes(postText)) return false;
    if (hashtag && !p.text.toLowerCase().includes('#' + hashtag)) return false;
    if (authorType === 'person' && p.authorType !== 'Person') return false;
    if (authorType === 'company' && p.authorType !== 'Company') return false;
    if (postType === 'original' && p.isRepost) return false;
    if (postType === 'repost' && !p.isRepost) return false;
    if (p.likes < minLikes) return false;
    if (p.comments < minComments) return false;
    if (p.reposts < minReposts) return false;
    if ((p.likes + p.comments + p.reposts) < minTotal) return false;
    if (postedAfter && p.postedAtISO) {
      const postedTs = new Date(p.postedAtISO).getTime();
      if (Number.isFinite(postedTs) && postedTs < postedAfter) return false;
    }
    if (postedBefore && p.postedAtISO) {
      const postedTs = new Date(p.postedAtISO).getTime();
      if (Number.isFinite(postedTs) && postedTs > postedBefore) return false;
    }
    return true;
  });

  renderResults();
}

function renderResults() {
  countEl.textContent = `(${filteredResults.length}${filteredResults.length !== allResults.length ? ` of ${allResults.length}` : ''})`;

  const activeFilters = [];
  if (fIndustry.value.trim()) activeFilters.push(`industry: "${fIndustry.value.trim()}"`);
  if (fAuthorName.value.trim()) activeFilters.push(`author: "${fAuthorName.value.trim()}"`);
  if (fJobTitle.value.trim()) activeFilters.push(`title: "${fJobTitle.value.trim()}"`);
  if (fPostText.value.trim()) activeFilters.push(`text: "${fPostText.value.trim()}"`);
  if (fHashtag.value.trim()) activeFilters.push(`#${fHashtag.value.trim().replace(/^#/, '')}`);
  if (fAuthorType.value === 'person') activeFilters.push('people only');
  if (fAuthorType.value === 'company') activeFilters.push('companies only');
  if (fPostType.value === 'original') activeFilters.push('original only');
  if (fPostType.value === 'repost') activeFilters.push('reposts only');
  if (parseInt(fMinLikes.value, 10) > 0) activeFilters.push(`≥${fMinLikes.value} likes`);
  if (parseInt(fMinComments.value, 10) > 0) activeFilters.push(`≥${fMinComments.value} comments`);
  if (parseInt(fMinReposts.value, 10) > 0) activeFilters.push(`≥${fMinReposts.value} reposts`);
  if (parseInt(fMinTotal.value, 10) > 0) activeFilters.push(`≥${fMinTotal.value} total`);
  if (fPostedAfter.value) activeFilters.push(`after ${fPostedAfter.value}`);
  if (fPostedBefore.value) activeFilters.push(`before ${fPostedBefore.value}`);
  filterSummary.textContent = activeFilters.length ? `Filters: ${activeFilters.join(' • ')}` : '';

  if (filteredResults.length === 0) {
    grid.classList.add('hidden');
    noMatches.classList.remove('hidden');
    updateSelectionUi();
    return;
  }

  noMatches.classList.add('hidden');
  grid.innerHTML = filteredResults.map(renderCard).join('');
  grid.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();

  grid.querySelectorAll('article[data-id]').forEach((article) => {
    const id = article.dataset.id;
    const checkbox = article.querySelector('.card-checkbox');
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) selectedIds.add(id);
      else selectedIds.delete(id);
      article.classList.toggle('border-indigo-500', checkbox.checked);
      article.classList.toggle('ring-2', checkbox.checked);
      article.classList.toggle('ring-indigo-100', checkbox.checked);
      article.classList.toggle('border-slate-200', !checkbox.checked);
      updateSelectionUi();
    });
  });

  updateSelectionUi();
}

function updateSelectionUi() {
  const visibleIds = filteredResults.map(postId);
  const selectedVisible = visibleIds.filter((id) => selectedIds.has(id)).length;

  selectedCountEl.textContent = selectedVisible > 0 ? `${selectedVisible} selected` : '';

  const rebuildBtn = (btn, iconName, label) => {
    btn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i><span>${label}</span>`;
  };
  rebuildBtn(downloadSelectedBtn, 'download', selectedVisible > 0 ? `Export selected (${selectedVisible})` : 'Export selected');
  rebuildBtn(downloadAllBtn, 'file-down', `Export all (${filteredResults.length})`);
  rebuildBtn(pushGhlBtn, 'send', selectedVisible > 0 ? `Push to Launchpad (${selectedVisible})` : 'Push to Launchpad');

  downloadSelectedBtn.disabled = selectedVisible === 0;
  pushGhlBtn.disabled = selectedVisible === 0;
  if (window.lucide) lucide.createIcons();

  if (visibleIds.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedVisible === visibleIds.length) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else if (selectedVisible === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

function toCsv(items) {
  const cols = [
    ['Author Name', 'authorName'],
    ['Headline', 'authorHeadline'],
    ['Profile URL', 'authorProfileUrl'],
    ['Email', 'email'],
    ['Phone', 'phone'],
    ['Post URL', 'postUrl'],
    ['Post Text', 'text'],
    ['Likes', 'likes'],
    ['Comments', 'comments'],
    ['Reposts', 'reposts'],
    ['Posted At', 'postedAtISO'],
    ['Time Since', 'timeSincePosted'],
  ];
  const esc = (v) => `"${String(v ?? '').replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;
  const header = cols.map(([h]) => esc(h)).join(',');
  const rows = items.map((n) => cols.map(([, k]) => esc(n[k])).join(','));
  return [header, ...rows].join('\n');
}

function downloadCsv(items, suffix = '') {
  if (items.length === 0) return;
  const csv = toCsv(items);
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = currentKeyword.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `linkedin_${safe || 'posts'}${suffix ? '_' + suffix : ''}_${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const keyword = document.getElementById('keyword').value.trim();
  const limit = document.getElementById('limit').value;
  const datePosted = document.getElementById('datePosted').value;
  const sortBy = document.getElementById('sortBy').value;
  if (!keyword) return;

  searchBtn.disabled = true;
  searchBtn.textContent = 'Searching…';
  emptyState.classList.add('hidden');
  toolbar.classList.add('hidden');
  grid.classList.add('hidden');
  noMatches.classList.add('hidden');
  setStatus('Scraping LinkedIn — this usually takes 30–90 seconds…', 'info');

  try {
    const res = await apiFetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, limit, datePosted, sortBy }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(`Error: ${data.error || 'search failed'}${data.details ? ' — ' + data.details : ''}`, 'error');
      emptyState.classList.remove('hidden');
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    allResults = items.map(normalize);
    filteredResults = [...allResults];
    currentKeyword = keyword;
    selectedIds.clear();

    if (allResults.length === 0) {
      setStatus('No posts found. Try a different keyword or broader date range.', 'info');
      emptyState.classList.remove('hidden');
      clientFilters.classList.add('hidden');
      return;
    }

    setStatus(`Found ${allResults.length} post(s). Use "Refine results" to filter further.`, 'success');
    clientFilters.classList.remove('hidden');
    toolbar.classList.remove('hidden');
    renderResults();
  } catch (err) {
    setStatus(`Request failed: ${err.message}`, 'error');
    emptyState.classList.remove('hidden');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = 'Search LinkedIn';
  }
});

const textFilterInputs = [fIndustry, fAuthorName, fJobTitle, fPostText, fHashtag, fMinLikes, fMinComments, fMinReposts, fMinTotal, fPostedAfter, fPostedBefore];
const selectFilterInputs = [fAuthorType, fPostType];
textFilterInputs.forEach((el) => el.addEventListener('input', applyFilters));
selectFilterInputs.forEach((el) => el.addEventListener('change', applyFilters));

if (reportMonthInput && !reportMonthInput.value) {
  reportMonthInput.value = new Date().toISOString().slice(0, 7);
}

clearFiltersBtn.addEventListener('click', () => {
  fIndustry.value = '';
  fAuthorName.value = '';
  fJobTitle.value = '';
  fPostText.value = '';
  fHashtag.value = '';
  fAuthorType.value = 'any';
  fPostType.value = 'any';
  fMinLikes.value = '0';
  fMinComments.value = '0';
  fMinReposts.value = '0';
  fMinTotal.value = '0';
  fPostedAfter.value = '';
  fPostedBefore.value = '';
  applyFilters();
});

selectAllCheckbox.addEventListener('change', () => {
  const visibleIds = filteredResults.map(postId);
  if (selectAllCheckbox.checked) {
    visibleIds.forEach((id) => selectedIds.add(id));
  } else {
    visibleIds.forEach((id) => selectedIds.delete(id));
  }
  renderResults();
});

downloadSelectedBtn.addEventListener('click', () => {
  const picked = filteredResults.filter((p) => selectedIds.has(postId(p)));
  downloadCsv(picked, 'selected');
});

downloadAllBtn.addEventListener('click', () => {
  downloadCsv(filteredResults);
});

function formatMonthLabel(value) {
  if (!value) return 'this month';
  const [y, m] = value.split('-').map((v) => parseInt(v, 10));
  const date = new Date(y, m - 1, 1);
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function toSafePdfText(value) {
  return String(value ?? '')
    .replace(/[\u2013\u2014]/g, '-') // en/em dash
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x00-\x7F]/g, ''); // strip non-ASCII for jsPDF default font
}

function shortUrl(value, maxLen = 80) {
  const raw = toSafePdfText(value);
  if (raw.length <= maxLen) return raw;
  return raw.slice(0, maxLen - 3) + '...';
}

function isInMonth(iso, monthValue) {
  if (!iso) return false;
  const dt = new Date(iso);
  if (!Number.isFinite(dt.getTime())) return false;
  const [y, m] = monthValue.split('-').map((v) => parseInt(v, 10));
  return dt.getFullYear() === y && (dt.getMonth() + 1) === m;
}

downloadPdfBtn.addEventListener('click', () => {
  if (!window.jspdf?.jsPDF) {
    setStatus('PDF library failed to load.', 'error');
    return;
  }

  const monthValue = reportMonthInput.value || new Date().toISOString().slice(0, 7);
  const monthLabel = formatMonthLabel(monthValue);
  const monthItems = filteredResults.filter((p) => isInMonth(p.postedAtISO, monthValue));

  if (monthItems.length === 0) {
    setStatus(`No posts found for ${monthLabel}.`, 'info');
    return;
  }

  const top = [...monthItems]
    .sort((a, b) => (b.likes + b.comments + b.reposts) - (a.likes + a.comments + a.reposts))
    .slice(0, 20);

  const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
  const margin = 48;
  const line = 16;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(toSafePdfText(`Top LinkedIn Opportunities - ${monthLabel}`), margin, y);
  y += line * 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  top.forEach((p, idx) => {
    const engagement = p.likes + p.comments + p.reposts;
    const title = `${idx + 1}. ${p.authorName || 'Unknown'} - ${p.authorHeadline || 'No headline'}`;
    const postLine = `Engagement: ${engagement} | Post: ${shortUrl(p.postUrl || 'n/a')}`;
    const snippet = (p.text || '').replace(/\s+/g, ' ').trim();

    const wrap = doc.splitTextToSize(toSafePdfText(title), 520);
    const wrapPost = doc.splitTextToSize(toSafePdfText(postLine), 520);
    const wrapText = doc.splitTextToSize(toSafePdfText(snippet), 520);

    const blockHeight = (wrap.length + wrapPost.length + Math.min(wrapText.length, 3)) * line + line;
    if (y + blockHeight > 720) {
      doc.addPage();
      y = margin;
    }

    doc.text(wrap, margin, y);
    y += line * wrap.length;
    doc.text(wrapPost, margin, y);
    y += line * wrapPost.length;
    if (wrapText.length) {
      doc.text(wrapText.slice(0, 3), margin, y);
      y += line * Math.min(wrapText.length, 3);
    }
    y += line;
  });

  const safeMonth = monthValue.replace('-', '_');
  doc.save(`top_linkedin_opportunities_${safeMonth}.pdf`);
  setStatus(`Generated PDF for ${monthLabel} (${top.length} posts).`, 'success');
});

pushGhlBtn.addEventListener('click', async () => {
  const picked = filteredResults.filter((p) => selectedIds.has(postId(p)));
  if (picked.length === 0) return;

  const originalHtml = pushGhlBtn.innerHTML;
  pushGhlBtn.disabled = true;
  pushGhlBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 spinner"></i><span>Pushing ${picked.length}…</span>`;
  if (window.lucide) lucide.createIcons();
  setStatus(`Pushing ${picked.length} post(s) to Launchpad — creating contacts, tasks, and notes…`, 'info');

  try {
    const res = await apiFetch('/api/ghl/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: picked }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(`Launchpad push failed: ${data.error || 'unknown error'}${data.message ? ' — ' + data.message : ''}`, 'error');
      return;
    }

    const bits = [];
    if (data.created) bits.push(`${data.created} new contact${data.created === 1 ? '' : 's'}`);
    if (data.existing) bits.push(`${data.existing} existing updated`);
    if (data.failed) bits.push(`${data.failed} failed`);
    const msg = `Pushed ${data.total} to Launchpad — ${bits.join(', ') || 'no changes'}`;
    setStatus(msg, data.failed ? 'error' : 'success');

    if (data.errors?.length) {
      console.warn('Launchpad push errors:', data.errors);
    }
  } catch (err) {
    setStatus(`Push request failed: ${err.message}`, 'error');
  } finally {
    pushGhlBtn.innerHTML = originalHtml;
    pushGhlBtn.disabled = false;
    updateSelectionUi();
  }
});
