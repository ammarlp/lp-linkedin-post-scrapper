/**
 * LinkedIn Voyager API client.
 *
 * LinkedIn's own web frontend talks to an internal REST API at
 * /voyager/api/... using the user's browser session cookies.
 * We replicate those exact HTTP calls here, which means:
 *   - No Apify, no third-party service, no extra cost
 *   - Data comes straight from LinkedIn's own backend
 *   - Requires the user's full cookie set (li_at + JSESSIONID at minimum)
 */

import { parseCookies } from './cookieHelper.js';

const VOYAGER_BASE = 'https://www.linkedin.com/voyager/api';

/**
 * Build request headers that mimic what the LinkedIn web app sends.
 * The CSRF token is the JSESSIONID cookie value (quotes stripped).
 */
function buildHeaders(cookieInput) {
  const cookieArray = parseCookies(cookieInput);

  const cookieStr = cookieArray.map((c) => `${c.name}=${c.value}`).join('; ');

  const jsessionId = cookieArray.find(
    (c) => c.name === 'JSESSIONID' || c.name === 'jsessionid'
  );
  // JSESSIONID is stored with surrounding quotes by the browser — strip them
  const csrfToken = jsessionId
    ? String(jsessionId.value).replace(/^"|"$/g, '')
    : '';

  return {
    Cookie: cookieStr,
    'csrf-token': csrfToken,
    'x-li-lang': 'en_US',
    'x-li-track': JSON.stringify({
      clientVersion: '1.13.9',
      mpVersion: '1.13.9',
      osName: 'web',
      timezoneOffset: 0,
      timezone: 'America/New_York',
      appInstance: '',
      mpName: 'voyager-web',
      displayDensity: 'REGULAR',
      displayWidth: 1920,
      displayHeight: 1080,
    }),
    Accept: 'application/vnd.linkedin.normalized+json+2.1',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'x-restli-protocol-version': '2.0.0',
  };
}

async function voyagerGet(path, params, headers) {
  const qs = new URLSearchParams(params).toString();
  const url = `${VOYAGER_BASE}${path}${qs ? '?' + qs : ''}`;

  const res = await fetch(url, { headers });
  const text = await res.text();

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`LinkedIn returned non-JSON (status ${res.status}): ${text.slice(0, 300)}`);
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `LinkedIn session expired or invalid (${res.status}). Please refresh your cookies.`
    );
  }
  if (!res.ok) {
    throw new Error(
      `Voyager API error ${res.status}: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  return data;
}

// ─── Connections ─────────────────────────────────────────────────────────────

function extractPicture(member) {
  // Profile pictures are nested in displayImage artifact chains
  try {
    const artifacts =
      member?.profilePicture?.displayImageReference?.vectorImage?.artifacts ||
      member?.picture?.com_linkedin_voyager_common_MediaProcessorImage?.id ||
      [];
    if (Array.isArray(artifacts) && artifacts.length > 0) {
      // Pick the largest available
      const sorted = [...artifacts].sort(
        (a, b) => (b.width || 0) - (a.width || 0)
      );
      const rootUrl =
        member?.profilePicture?.displayImageReference?.vectorImage?.rootUrl || '';
      return rootUrl + (sorted[0]?.fileIdentifyingUrlPathSegment || '');
    }
  } catch {
    // ignore
  }
  return '';
}

/**
 * LinkedIn returns "normalized" JSON:
 *   { data: { '*elements': [urn, urn, ...], paging: {...} }, included: [...objects] }
 *
 * '*elements' is a list of URN strings pointing into the 'included' array.
 * Each object in 'included' has an 'entityUrn' we use as the lookup key.
 * Connection objects inside 'included' have a '*connectedMember' field that
 * is itself a URN pointing to the profile object also in 'included'.
 */
function buildUrnMap(included = []) {
  const map = new Map();
  for (const obj of included) {
    if (obj.entityUrn) map.set(obj.entityUrn, obj);
  }
  return map;
}

function normalizeConnection(connObj, urnMap) {
  // Resolve the profile via *connectedMember URN
  const memberUrn = connObj['*connectedMember'] || connObj.connectedMember || '';
  const m = (typeof memberUrn === 'string' ? urnMap.get(memberUrn) : memberUrn) || connObj;

  const createdAt = connObj.createdAt
    ? new Date(connObj.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : '';

  const firstName = m.firstName || '';
  const lastName = m.lastName || '';
  const name = [firstName, lastName].filter(Boolean).join(' ') || m.name || '';
  const publicId = m.publicIdentifier || '';
  const profileUrl = publicId ? `https://www.linkedin.com/in/${publicId}/` : '';

  return {
    name,
    headline: m.headline || m.occupation || '',
    profileUrl,
    picture: extractPicture(m),
    location: m.geoLocation?.geo?.defaultLocalizedName || m.locationName || '',
    connectedAt: createdAt,
    degree: '1st',
    company: m.headline || '',
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch the authenticated user's 1st-degree connections.
 */
export async function getConnections(cookieInput, limit = 100) {
  const headers = buildHeaders(cookieInput);
  const count = 40;
  const allConnections = [];
  let start = 0;

  while (allConnections.length < limit) {
    // Small delay between pages to avoid LinkedIn rate-limiting
    if (start > 0) await sleep(800);

    let resp;
    try {
      resp = await voyagerGet(
        '/relationships/dash/connections',
        {
          decorationId:
            'com.linkedin.voyager.dash.deco.web.mynetwork.ConnectionListWithProfile-5',
          count,
          q: 'search',
          start,
        },
        headers
      );
    } catch (err) {
      // If we already have some results, return them rather than failing the whole job
      if (allConnections.length > 0) {
        console.warn(`[voyager:connections] page at start=${start} failed (${err.message}), returning ${allConnections.length} collected so far`);
        break;
      }
      throw err;
    }

    // Normalized format: { data: { '*elements': [...urns] }, included: [...objects] }
    const urnRefs  = resp.data?.['*elements'] || [];
    const included = resp.included || [];
    const paging   = resp.data?.paging;

    if (urnRefs.length === 0) break;

    const urnMap = buildUrnMap(included);

    for (const urn of urnRefs) {
      const connObj = urnMap.get(urn);
      if (!connObj) continue;
      allConnections.push(normalizeConnection(connObj, urnMap));
    }
    start += urnRefs.length;

    // Stop if LinkedIn returned a short page (we've reached the end)
    if (urnRefs.length < count) break;
  }

  return allConnections.slice(0, limit);
}

// ─── Feed (posts from connections) ───────────────────────────────────────────

function resolveUrn(val, urnMap) {
  if (typeof val === 'string' && urnMap) return urnMap.get(val) || null;
  return val || null;
}

function normalizePost(update, urnMap) {
  // Resolve actor (author) — may be inline or a URN reference
  const actor = resolveUrn(update['*actor'] || update.actor, urnMap) || update.actor || {};

  // Author name
  const name =
    actor.name?.text ||
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') ||
    actor.title?.text || '';

  // Author type — derive from actor URN (urn:li:member = Person, urn:li:company/organization = Company)
  const actorUrn = actor.urn || '';
  const authorType = actorUrn.includes('urn:li:company') || actorUrn.includes('urn:li:organization')
    ? 'Company'
    : 'Person';

  // Author profile URL — actor has no navigationUrl; resolve miniProfile URN for publicIdentifier
  const miniProfileUrn = actor.image?.attributes?.[0]?.['*miniProfile'];
  const miniProfile = resolveUrn(miniProfileUrn, urnMap) || {};
  const publicId = miniProfile.publicIdentifier || actor.publicIdentifier || '';
  // Companies use /company/ path, persons use /in/
  const profileUrl = publicId
    ? `https://www.linkedin.com/${authorType === 'Company' ? 'company' : 'in'}/${publicId}/`
    : actor.navigationUrl || '';

  // Post text — resolve commentary URN if needed
  const commentaryObj = resolveUrn(update['*commentary'] || update.commentary, urnMap) || update.commentary || {};
  const text =
    commentaryObj?.text?.text ||
    commentaryObj?.text ||
    update.headerText?.text ||
    '';

  // Post URL
  const shareUrl = update.socialContent?.shareUrl || '';
  const postUrl = shareUrl || (update.updateMetadata?.urn
    ? `https://www.linkedin.com/feed/update/${update.updateMetadata.urn}/`
    : '');

  // Engagement counts — socialDetail['*totalSocialActivityCounts'] is itself a URN, resolve it
  const socialDetail = resolveUrn(update['*socialDetail'] || update.socialDetail, urnMap) || {};
  const countsObj = resolveUrn(socialDetail['*totalSocialActivityCounts'], urnMap) || {};
  const likes    = countsObj.numLikes    || 0;
  const comments = countsObj.numComments || 0;
  const reposts  = countsObj.numShares   || socialDetail.totalShares || 0;

  // Timestamp
  const postedAt =
    actor.subDescription?.text ||
    update.actor?.subDescription?.text ||
    '';

  // Profile picture
  let picture = '';
  try {
    const imgData =
      actor.image?.attributes?.[0]?.detailData?.nonEntityProfilePicture?.vectorImage ||
      actor.image?.attributes?.[0]?.detailData?.profilePicture?.displayImageReference?.vectorImage ||
      actor.profilePicture?.displayImageReference?.vectorImage ||
      null;
    if (imgData?.rootUrl && imgData?.artifacts?.length) {
      picture = imgData.rootUrl + imgData.artifacts[0].fileIdentifyingUrlPathSegment;
    }
  } catch { /* ignore */ }

  return {
    authorName: name,
    authorHeadline: actor.description?.text || actor.headline || '',
    authorProfileUrl: profileUrl,
    authorProfilePicture: picture,
    authorType,
    postUrl,
    text,
    numLikes: likes,
    numComments: comments,
    numShares: reposts,
    timeSincePosted: postedAt,
    postedAtISO: '',
    isRepost: false,
  };
}

/**
 * Fetch the authenticated user's connection feed (posts from 1st-degree connections).
 */
export async function getConnectionFeed(cookieInput, limit = 25, keyword = '') {
  const headers = buildHeaders(cookieInput);
  const count = 25;
  const allPosts = [];
  const seenKeys = new Set(); // deduplicate by postUrl, falling back to author+text
  let start = 0;

  while (allPosts.length < limit) {
    if (start > 0) await sleep(800);

    const data = await voyagerGet('/feed/updatesV2', {
      count,
      start,
      q: 'chronFeed',
      feedType: 'CONNECTIONS',
    }, headers);

    const urnRefs  = data.data?.['*elements'] || [];
    const included = data.included || [];

    if (urnRefs.length === 0) break;
    const urnMap = buildUrnMap(included);

    for (const urn of urnRefs) {
      const update = urnMap.get(urn);
      if (!update) continue;
      const post = normalizePost(update, urnMap);

      // Build a dedup key: prefer postUrl, fall back to author+first 80 chars of text
      const dedupKey = post.postUrl || `${post.authorName}::${post.text.slice(0, 80)}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      if (!keyword || post.text.toLowerCase().includes(keyword.toLowerCase())) {
        allPosts.push(post);
      }
    }

    start += urnRefs.length;
    if (urnRefs.length < count) break;
  }

  return allPosts.slice(0, limit);
}
