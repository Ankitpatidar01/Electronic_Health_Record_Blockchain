'use strict';

const { Contract } = require('fabric-contract-api');
const { requireRole } = require('./accessControl');

// StatsContract — ledger-wide counts for the observability dashboard.
// Returns numbers only: no identifiers, names, codes or CIDs. Callable by the
// hospital administrator and by the read-only dashboard observer identity.

async function scan(ctx, prefix, visit) {
  const iterator = await ctx.stub.getStateByRange(`${prefix}:`, `${prefix};`);
  while (true) {
    const res = await iterator.next();
    if (res.done) break;
    if (res.value && res.value.value && res.value.value.length > 0) {
      visit(JSON.parse(res.value.value.toString('utf8')));
    }
  }
  await iterator.close();
}

const bump = (map, key) => { map[key || 'UNKNOWN'] = (map[key || 'UNKNOWN'] || 0) + 1; };

class StatsContract extends Contract {
  constructor() {
    super('StatsContract');
  }

  async GetStats(ctx) {
    requireRole(ctx, 'admin', 'observer');

    const stats = {
      patients: 0,
      visits: { total: 0, byStatus: {} },
      dids: 0,
      documents: 0, // CIDs recorded across all DIDs
      labRequests: { total: 0, byStatus: {} },
      diseaseCodes: {
        patientsWithCode: 0, provisional: 0, confirmed: 0,
        doctorDecisions: 0, decisionsWithAiSuggestion: 0, matchedAiSuggestion: 0, matchedProvisional: 0,
      },
    };

    await scan(ctx, 'PATIENT', () => { stats.patients += 1; });
    await scan(ctx, 'VISIT', (v) => { stats.visits.total += 1; bump(stats.visits.byStatus, v.status); });
    await scan(ctx, 'DID', (d) => { stats.dids += 1; stats.documents += d.entryCount || 0; });
    await scan(ctx, 'LABREQ', (r) => { stats.labRequests.total += 1; bump(stats.labRequests.byStatus, r.status); });
    await scan(ctx, 'DCODE', (c) => {
      const s = stats.diseaseCodes;
      s.patientsWithCode += 1;
      if (c.status === 'CONFIRMED') s.confirmed += 1; else if (c.status === 'PROVISIONAL') s.provisional += 1;
      for (const h of c.history || []) {
        if (h.action === 'PROVISIONAL') continue;
        s.doctorDecisions += 1;
        if (h.matchesProvisional) s.matchedProvisional += 1;
        if ((h.aiSuggestedCodes || []).length > 0) {
          s.decisionsWithAiSuggestion += 1;
          if (h.matchesAiSuggestion) s.matchedAiSuggestion += 1;
        }
      }
    });
    return JSON.stringify(stats);
  }
}

module.exports = { StatsContract };
