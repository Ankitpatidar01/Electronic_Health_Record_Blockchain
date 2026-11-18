'use strict';

/**
 * Hospital Clinical Capability Adapter (clinical.js)
 * Re-exports runClinicalAgent from clinical-agent.js for backward compatibility.
 */

const {
  runClinicalAgent,
  runLocalDiseaseTools,
  evaluateHeartDiseaseJS,
  evaluateKidneyDiseaseJS,
  evaluateMetabolicDiseaseJS,
  evaluateHematologicDiseaseJS
} = require('./clinical-agent');

module.exports = {
  runClinicalAgent,
  runLocalDiseaseTools,
  evaluateHeartDiseaseJS,
  evaluateKidneyDiseaseJS,
  evaluateMetabolicDiseaseJS,
  evaluateHematologicDiseaseJS
};
