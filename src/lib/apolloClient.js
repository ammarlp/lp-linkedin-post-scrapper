import { config } from '../config.js';
import { fetchJson } from './httpClient.js';

function isVerifiedEmailStatus(status) {
  if (!status) return false;
  const normalized = String(status).toLowerCase();
  return config.apollo.verifiedEmailStatuses.includes(normalized);
}

export async function matchPerson({ linkedinUrl, firstName, lastName, organizationName }) {
  if (!config.apollo.apiKey) return null;
  if (!linkedinUrl && !(firstName && lastName)) return null;

  const body = {
    api_key: config.apollo.apiKey,
    reveal_personal_emails: config.apollo.revealPersonalEmails,
    reveal_phone_number: true,
    linkedin_url: linkedinUrl || undefined,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    organization_name: organizationName || undefined,
  };

  console.log(`[apollo] matching ${firstName} ${lastName}${linkedinUrl ? ' · ' + linkedinUrl : ''}`);
  try {
    const data = await fetchJson(`${config.apollo.baseUrl}/people/match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': config.apollo.apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!data.person) {
      console.log(`[apollo] no match found for ${firstName} ${lastName}${linkedinUrl ? ' (' + linkedinUrl + ')' : ''}`);
    }
    return data.person || null;
  } catch (err) {
    console.warn(`[apollo] API error ${err.status ?? '?'} for ${firstName} ${lastName}: ${err.message}`);
    if (err.status === 404 || err.status === 422) return null;
    throw err;
  }
}

export function extractEnrichment(person) {
  if (!person) return null;
  const org = person.organization || {};
  const emailStatus = person.email_status || null;
  const emailVerified = isVerifiedEmailStatus(emailStatus);
  return {
    email: emailVerified ? person.email || null : null,
    emailStatus,
    emailVerified,
    title: person.title || null,
    seniority: person.seniority || null,
    organization: org.name || null,
    organizationWebsite: org.website_url || null,
    city: person.city || null,
    state: person.state || null,
    country: person.country || null,
    phone:
      person.sanitized_phone ||
      person.phone_numbers?.[0]?.sanitized_number ||
      null,
    linkedinUrl: person.linkedin_url || null,
  };
}
