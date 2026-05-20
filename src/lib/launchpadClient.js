import { config } from '../config.js';
import { fetchJson } from './httpClient.js';

// { id, fieldKey } — both needed: id for writing, fieldKey for filtering
let cachedLinkedInField = null;

export async function launchpadFetch(path, options = {}) {
  return fetchJson(`${config.launchpad.baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${config.launchpad.pit}`,
      Version: config.launchpad.version,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
}

export async function ensureLinkedInCustomField() {
  if (cachedLinkedInField) return cachedLinkedInField;

  const data = await launchpadFetch(
    `/locations/${config.launchpad.locationId}/customFields?model=contact`,
  );
  const fields = data.customFields || data.fields || [];
  const existing = fields.find(
    (f) =>
      f.name === 'LinkedIn Profile URL' ||
      f.fieldKey === 'contact.linkedin_profile_url',
  );
  if (existing) {
    cachedLinkedInField = { id: existing.id, fieldKey: existing.fieldKey };
    console.log(`[launchpad] found existing custom field: id=${existing.id} key=${existing.fieldKey}`);
    return cachedLinkedInField;
  }

  console.log('[launchpad] creating LinkedIn Profile URL custom field');
  const created = await launchpadFetch(
    `/locations/${config.launchpad.locationId}/customFields`,
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'LinkedIn Profile URL',
        dataType: 'TEXT',
        model: 'contact',
      }),
    },
  );
  const cf = created.customField || created.field || created;
  cachedLinkedInField = { id: cf.id, fieldKey: cf.fieldKey };
  return cachedLinkedInField;
}

export function splitName(full) {
  if (!full) return { firstName: 'Unknown', lastName: '' };
  const parts = String(full).trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Strip query params and trailing slash from a LinkedIn profile URL so
 * URLs like /in/john?miniProfileUrn=... and /in/john/ both normalise to
 * https://www.linkedin.com/in/john
 */
export function normalizeLinkedInUrl(url) {
  if (!url) return '';
  const m = url.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/([^/?#]+)/i);
  if (m) return `https://www.linkedin.com/in/${m[1]}`;
  // fallback: strip query string at minimum
  return url.split('?')[0].replace(/\/$/, '');
}

/** Extract the LinkedIn username/slug from a profile URL. */
function linkedinSlug(url) {
  const m = normalizeLinkedInUrl(url).match(/\/in\/([^/?#]+)$/i);
  return m ? m[1] : '';
}

export async function findContactByLinkedIn(url, _field) {
  if (!url) return null;
  const cleanUrl = normalizeLinkedInUrl(url);

  // Query search using just the slug (well under GHL's 75-char limit).
  // GHL's /contacts/search filters do not support custom fields, so we
  // search by slug and verify by inspecting the returned contact's custom fields.
  const slug = linkedinSlug(url);
  if (!slug) return null;

  try {
    const res = await launchpadFetch('/contacts/search', {
      method: 'POST',
      body: JSON.stringify({
        locationId: config.launchpad.locationId,
        pageLimit: 10,
        query: slug,
      }),
    });
    const found = (res.contacts || []).find((c) => {
      const fields = c.customFields || c.customField || [];
      return fields.some((f) => normalizeLinkedInUrl(f.value) === cleanUrl);
    });
    if (found) return found;
  } catch (err) {
    console.warn('[launchpad] search by slug failed:', err.message);
  }

  return null;
}

export async function createContact({ post, enrichment, field, fieldId, tags = [] }) {
  // Accept either { field: {id,fieldKey} } (new) or { fieldId: string } (legacy)
  const resolvedFieldId = field?.id ?? fieldId;
  const cleanLinkedInUrl = normalizeLinkedInUrl(post.authorProfileUrl);
  const { firstName, lastName } = splitName(post.authorName);
  const email =
    enrichment?.email ||
    post.email ||
    post.workEmail ||
    post.personalEmail ||
    post.authorEmail ||
    '';
  const phone =
    enrichment?.phone ||
    post.phone ||
    post.phoneNumber ||
    post.mobilePhone ||
    post.authorPhone ||
    '';

  const body = {
    firstName,
    lastName,
    locationId: config.launchpad.locationId,
    source: 'LinkedIn Post Finder',
    tags: [
      'linkedin-lead',
      'Lead-Gen-2026',
      ...(enrichment?.email ? ['apollo-verified-email'] : []),
      ...tags,
    ],
    customFields: [{ id: resolvedFieldId, field_value: cleanLinkedInUrl }],
  };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (enrichment?.organization) body.companyName = enrichment.organization;

  const res = await launchpadFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.contact || res;
}

export async function addTask(contactId, post) {
  const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const rawText = post.text || '';
  const snippet = rawText.slice(0, 60).replace(/\s+/g, ' ').trim();
  const title = `Review LinkedIn post${
    snippet ? ': ' + snippet + (rawText.length > 60 ? '…' : '') : ''
  }`;
  return launchpadFetch(`/contacts/${contactId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      body: post.postUrl || '',
      dueDate,
      completed: false,
    }),
  });
}

export async function addNote(contactId, post, enrichment) {
  const lines = [
    post.text || '(no text)',
    '',
    '— Engagement —',
    `Likes: ${post.likes || 0}`,
    `Comments: ${post.comments || 0}`,
    `Reposts: ${post.reposts || 0}`,
    '',
    `Post URL: ${post.postUrl || 'n/a'}`,
    `Profile: ${post.authorProfileUrl || 'n/a'}`,
    `Headline: ${post.authorHeadline || 'n/a'}`,
  ];

  if (enrichment) {
    lines.push('', '— Apollo Enrichment —');
    if (enrichment.email) {
      lines.push(
        `Verified Email: ${enrichment.email} (${enrichment.emailStatus || 'verified'})`,
      );
    } else if (enrichment.emailStatus) {
      lines.push(`Email Status: ${enrichment.emailStatus}`);
    }

    if (enrichment.title) lines.push(`Title: ${enrichment.title}`);
    if (enrichment.organization)
      lines.push(`Company: ${enrichment.organization}`);
    if (enrichment.seniority) lines.push(`Seniority: ${enrichment.seniority}`);
    const loc = [enrichment.city, enrichment.state, enrichment.country]
      .filter(Boolean)
      .join(', ');
    if (loc) lines.push(`Location: ${loc}`);
  }

  lines.push('', `Scraped: ${new Date().toISOString()}`);
  return launchpadFetch(`/contacts/${contactId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ body: lines.join('\n') }),
  });
}
