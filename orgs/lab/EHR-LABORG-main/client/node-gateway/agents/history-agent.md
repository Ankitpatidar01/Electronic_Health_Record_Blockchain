# 📋 Patient History / Timeline Agent Specification

**Component:** Patient History & Timeline Agent  
**Architectural Location:** `orgs/lab/EHR-LABORG-main/client/node-gateway/agents/history-agent.js`  
**Owner:** Abdullah  
**Version:** 1.0.0  

---

## 1. Purpose & Scope

The **Patient History Agent** is an autonomous specialized agent in the multi-agent Healthcare Blockchain Ecosystem. Its sole responsibility is retrieving, organizing, and analyzing a patient's historical medical information without performing autonomous medical diagnosis or treatment recommendations.

### Key Capabilities:
1. **Patient History Retrieval:** Connects strictly to the authorized data-access interface (`gateway.js`) to fetch historical clinical records.
2. **Chronological Timeline Construction:** Assembles and strictly sorts past clinical encounters and test reports chronologically (oldest to newest), preserving original test names, timestamps, measurement values, and units.
3. **Factual Longitudinal Trend Analysis:** Groups historical measurements by parameter (e.g., Hemoglobin, Blood Pressure, Platelets) and computes factual trajectory direction (`INCREASING`, `DECREASING`, `STABLE`, `FLUCTUATING`, or `INSUFFICIENT_DATA`) and numeric deltas.
4. **Strict Security & Patient Isolation:** Drops and alerts on any record not matching the authorized patient ID to prevent cross-patient data leakage.
5. **Deterministic Shared Result Contract:** Returns a structured `AgentResult` conformant to the central orchestrator's expectations.

---

## 2. Shared Contracts

### 2.1 Input Contract (`AgentContext`)
The agent receives an approved `AgentContext` object from the central orchestrator:

```typescript
interface AgentContext {
  patientId: string;              // Mandatory: Unique patient identifier
  options?: {
    peerName?: string;            // Optional target Fabric peer
    dataProvider?: (patientId: string) => Promise<any[]>; // Optional mock/test provider
  };
  correlationId?: string;         // Optional workflow tracking identifier
}
```

### 2.2 Output Contract (`AgentResult`)
The agent produces a deterministic `AgentResult`:

```typescript
interface AgentResult {
  status: "SUCCESS" | "EMPTY" | "ERROR";
  agentId: "history-agent-v1";
  patientId: string;
  historyCount: number;
  timeline: Array<{
    date: string;
    recordType: "LAB_RESULT" | "CLINICAL_RECORD";
    sourceId: string;
    testCode: string;
    status: string;
    observations: Array<{
      parameter: string;
      value: string;
      numericValue: number | null;
      unit: string | null;
    }>;
  }>;
  trendSummary: {
    parametersAnalyzed: number;
    trends: Array<{
      parameter: string;
      direction: "INCREASING" | "DECREASING" | "STABLE" | "FLUCTUATING" | "INSUFFICIENT_DATA";
      firstValue: string;
      latestValue: string;
      delta: number | null;
      unit: string | null;
      observationCount: number;
      factualStatement: string;
    }>;
    notablePatterns: string[];
  };
  warnings: string[];
  error?: {
    code: string;
    message: string;
  };
  metadata: {
    executionTimeMs: number;
    timestamp: string;
  };
}
```

---

## 3. Strict Boundary Compliance

| Permitted Behavior | Prohibited Behavior |
| :--- | :--- |
| ✅ Read `patientId` from `AgentContext` | ❌ Accept arbitrary patient IDs from unvalidated sources |
| ✅ Retrieve data via `gateway.getLabResultsByPatient` | ❌ Direct gRPC calls to Hyperledger Fabric peers |
| ✅ Filter records matching `patientId` strictly | ❌ Direct IPFS Kubo CID manipulation or downloads |
| ✅ Math & trajectory delta calculation | ❌ Direct Google Gemini or LLM API calls |
| ✅ Non-diagnostic factual timeline summaries | ❌ Autonomous medical diagnosis or prescribing medication |
| ✅ Transparent error codes on gateway failure | ❌ Modifying orchestrator, Lab Agent, or server.js logic |

---

## 4. Execution & Testing

The agent is independently testable via Node.js native test runner:

```bash
cd orgs/lab/EHR-LABORG-main/client/node-gateway
node --test tests/history-agent.test.js
```
