import { matchPerson, extractEnrichment } from '../lib/apolloClient.js';
import { splitName } from '../lib/launchpadClient.js';
import { EnrichedProfile } from '../models/EnrichedProfile.js';

export async function enrichProfile(post) {
  const linkedinUrl = post.authorProfileUrl;

  if (linkedinUrl) {
    const cached = await EnrichedProfile.findByLinkedIn(linkedinUrl);
    if (cached?.enrichment) {
      console.log(`[apollo] cache hit ${post.authorName}`);
      return cached.enrichment;
    }
  }

  const { firstName, lastName } = splitName(post.authorName);
  let person;
  try {
    person = await matchPerson({ linkedinUrl, firstName, lastName });
  } catch (err) {
    console.warn(`[apollo] match failed ${post.authorName}: ${err.message}`);
    return null;
  }

  const enrichment = extractEnrichment(person);
  if (enrichment) {
    console.log(
      `[apollo] enriched ${post.authorName}${enrichment.email ? ' ✉' : ''}${enrichment.title ? ' · ' + enrichment.title : ''}`,
    );
    if (linkedinUrl) {
      await EnrichedProfile.upsert({
        linkedinUrl,
        authorName: post.authorName,
        enrichment,
      });
    }
  }
  return enrichment;
}
