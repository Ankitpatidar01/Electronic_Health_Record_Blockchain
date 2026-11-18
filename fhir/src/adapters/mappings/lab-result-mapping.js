'use strict';

/**
 * lab-result-mapping.js — legacy lab result → FHIR R4 DiagnosticReport + contained Observations.
 *
 * Source shape (mirrors ehr-backend-v3 lab flow; labRequests[].results in the
 * IPFS visit JSON):
 *   {
 *     patientId, visitId, labRequestId, panel: "CBC",
 *     results: {
 *       "Hemoglobin": { value: 8.5, unit: "g/dL", loinc: "718-7" },
 *       ...
 *     },
 *     submittedBy, submittedAt
 *   }
 *
 * Each measurement becomes a contained Observation with a LOINC-coded `code`
 * and a UCUM `valueQuantity`. The DiagnosticReport references them.
 */

function map(l, ctx) {
  const observations = [];
  const resultRefs = [];

  for (const [name, r] of Object.entries(l.results || {})) {
    const obsId = `OBS-${l.labRequestId}-${name}`;
    const obs = {
      resourceType: 'Observation',
      id: obsId,
      status: 'final',
      subject: { reference: `Patient/${l.patientId}` },
      code: {
        coding: [{ system: 'http://loinc.org', code: r.loinc, display: name }],
      },
    };

    if (r.value !== undefined && r.unit !== undefined) {
      obs.valueQuantity = {
        value: r.value,
        unit: r.unit,
        system: 'http://unitsofmeasure.org',
        code: r.unit,
      };
    } else if (r.value !== undefined) {
      obs.valueQuantity = { value: r.value };
    }

    observations.push(obs);
    resultRefs.push({ reference: `#${obsId}` });
  }

  const report = {
    resourceType: 'DiagnosticReport',
    id: `DR-${l.labRequestId}`,
    status: 'final',
    subject: { reference: `Patient/${l.patientId}` },
    result: resultRefs,
    contained: observations,
    performer: [{ reference: 'Organization/DiagnosticsOrg' }],
  };

  // Never emit `undefined` — the strict RFC 8785 canonicalizer rejects it.
  if (l.panel) report.code = { text: l.panel };
  if (l.submittedAt) report.issued = l.submittedAt;

  return report;
}

module.exports = { map };
