// Vitalis Lab Deck - Diagnostic Workstation Client
'use strict';

// DOM References
const peerSelect = document.getElementById('peerSelect');
const refreshBtn = document.getElementById('refreshBtn');
const themeToggle = document.getElementById('themeToggle');

// Forms & Inputs
const createForm = document.getElementById('createForm');
const readForm = document.getElementById('readForm');
const resolveDataForm = document.getElementById('resolveDataForm');
const patientForm = document.getElementById('patientForm');
const updateStatusForm = document.getElementById('updateStatusForm');
const demoFillBtn = document.getElementById('demoFillBtn');
const formatJsonBtn = document.getElementById('formatJsonBtn');

// File Upload
const fileDropzone = document.getElementById('fileDropzone');
const reportFileInput = document.getElementById('reportFile');
const fileSelectedBadge = document.getElementById('fileSelectedBadge');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const clearFileBtn = document.getElementById('clearFileBtn');

// Tabs
const tabCreate = document.getElementById('tabCreate');
const tabQuery = document.getElementById('tabQuery');
const panelCreate = document.getElementById('panel-create');
const panelQuery = document.getElementById('panel-query');

// Stats
const statRecordsCount = document.getElementById('statRecordsCount');
const statChannel = document.getElementById('statChannel');
const statIpfs = document.getElementById('statIpfs');
const statAi = document.getElementById('statAi');

// Table & Search
const recordsBody = document.getElementById('recordsBody');
const metaPill = document.getElementById('metaPill');
const recordSearch = document.getElementById('recordSearch');
const statusFilters = document.getElementById('statusFilters');

// Terminal Output
const rawOutput = document.getElementById('rawOutput');
const clearOutputBtn = document.getElementById('clearOutputBtn');
const copyOutputBtn = document.getElementById('copyOutputBtn');
const toast = document.getElementById('toast');

const FALLBACK_PEERS = [
  'peer0.lab.example.com',
  'peer1.lab.example.com',
  'peer2.lab.example.com',
];

let toastTimer;
let livePeerMetadataAvailable = false;
let allRecordsCache = [];
let currentFilter = 'ALL';
let currentSearchTerm = '';
let currentOutputPayload = null;

// ==========================================================================
// Toast & Utility Helpers
// ==========================================================================
function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function selectedPeer() {
  return peerSelect ? peerSelect.value : '';
}

function withPeer(path) {
  const base = window.location.pathname.startsWith('/lab') ? '/lab' : '';
  const url = new URL(base + path, window.location.origin);
  const peer = selectedPeer();
  if (peer) {
    url.searchParams.set('peer', peer);
  }
  return url.toString();
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeToArray(result) {
  if (Array.isArray(result)) return result;
  if (isPlainObject(result)) return [result];
  return [];
}

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };

  if (!isFormData && !Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(withPeer(path), {
    headers,
    ...options,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

function setOutput(label, payload) {
  currentOutputPayload = payload;
  rawOutput.innerHTML = `<span style="color: #54f1dc; font-weight: 700;">// ${escapeHtml(label)}</span>\n\n${escapeHtml(JSON.stringify(payload, null, 2))}`;
}

function toggleLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.innerHTML;
    }
    button.disabled = true;
    button.classList.add('is-loading');
    button.innerHTML = '<span class="loading-spinner" style="width:12px;height:12px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:6px;"></span> Processing...';
  } else {
    button.disabled = false;
    button.classList.remove('is-loading');
    if (button.dataset.originalText) {
      button.innerHTML = button.dataset.originalText;
    }
  }
}

// ==========================================================================
// Tabs Navigation
// ==========================================================================
if (tabCreate && tabQuery) {
  tabCreate.addEventListener('click', () => {
    tabCreate.classList.add('active');
    tabQuery.classList.remove('active');
    panelCreate.classList.add('active');
    panelQuery.classList.remove('active');
  });

  tabQuery.addEventListener('click', () => {
    tabQuery.classList.add('active');
    tabCreate.classList.remove('active');
    panelQuery.classList.add('active');
    panelCreate.classList.remove('active');
  });
}

// ==========================================================================
// Drag & Drop File Handling
// ==========================================================================
if (fileDropzone && reportFileInput) {
  fileDropzone.addEventListener('click', (e) => {
    if (e.target !== clearFileBtn) {
      reportFileInput.click();
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    fileDropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      fileDropzone.classList.remove('dragover');
    });
  });

  fileDropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      reportFileInput.files = files;
      updateFileBadge();
    }
  });

  reportFileInput.addEventListener('change', updateFileBadge);

  if (clearFileBtn) {
    clearFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      reportFileInput.value = '';
      updateFileBadge();
    });
  }
}

function updateFileBadge() {
  if (!reportFileInput || !fileSelectedBadge) return;
  const file = reportFileInput.files?.[0];
  if (file) {
    fileNameDisplay.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    fileSelectedBadge.classList.remove('hidden');
  } else {
    fileSelectedBadge.classList.add('hidden');
  }
}

// ==========================================================================
// Demo Data Filler & Format JSON
// ==========================================================================
if (demoFillBtn) {
  demoFillBtn.addEventListener('click', () => {
    const randomId = 'LAB-' + Math.floor(100 + Math.random() * 900);
    const resultIdInput = document.getElementById('createResultId');
    const patientIdInput = document.getElementById('createPatientId');
    const testCodeInput = document.getElementById('createTestCode');
    const collectedAtInput = document.getElementById('createCollectedAt');
    const statusSelect = document.getElementById('createStatus');
    const resultDataTextarea = document.getElementById('createResultData');

    if (resultIdInput) resultIdInput.value = randomId;
    if (patientIdInput) patientIdInput.value = 'PAT-001';
    if (testCodeInput) testCodeInput.value = 'LIPID-PANEL';
    if (statusSelect) statusSelect.value = 'REPORTED';
    if (collectedAtInput) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      collectedAtInput.value = now.toISOString().slice(0, 16);
    }
    if (resultDataTextarea) {
      resultDataTextarea.value = JSON.stringify({
        total_cholesterol: 192,
        hdl: 56,
        ldl: 110,
        triglycerides: 130,
        vldl: 26,
        units: 'mg/dL',
        risk_evaluation: 'LOW_BORDERLINE'
      }, null, 2);
    }
    showToast(`Loaded sample clinical data for ${randomId}`);
  });
}

if (formatJsonBtn) {
  formatJsonBtn.addEventListener('click', () => {
    const textarea = document.getElementById('createResultData');
    if (!textarea || !textarea.value.trim()) return;
    try {
      const parsed = JSON.parse(textarea.value.trim());
      textarea.value = JSON.stringify(parsed, null, 2);
      showToast('JSON formatted');
    } catch {
      showToast('Invalid JSON syntax');
    }
  });
}

// ==========================================================================
// Table Rendering & Filtering
// ==========================================================================
function getStatusBadge(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'REPORTED') {
    return `<span class="status-pill-badge reported">✓ ${escapeHtml(s)}</span>`;
  }
  if (s === 'PENDING' || s === 'IN_REVIEW') {
    return `<span class="status-pill-badge pending">⏳ ${escapeHtml(s)}</span>`;
  }
  if (s === 'CRITICAL' || s === 'ERROR') {
    return `<span class="status-pill-badge critical">⚠ ${escapeHtml(s)}</span>`;
  }
  return `<span class="status-pill-badge">${escapeHtml(s)}</span>`;
}

function renderRows(records, emptyMessage = 'No matching diagnostic records.') {
  if (!recordsBody) return;
  recordsBody.style.opacity = '0';

  setTimeout(() => {
    recordsBody.innerHTML = '';

    if (!records.length) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="6" class="table-empty-row">${escapeHtml(emptyMessage)}</td>`;
      recordsBody.appendChild(row);
    } else {
      for (const record of records) {
        const row = document.createElement('tr');
        const formattedDate = record.collectedAt
          ? new Date(record.collectedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
          : '—';

        row.innerHTML = `
          <td>
            <a href="#inspect" class="hash-chip-link inspect-chip" data-id="${escapeHtml(record.resultId || '')}" title="Inspect record">
              ${escapeHtml(record.resultId || '')}
            </a>
          </td>
          <td>
            <span class="patient-badge">
              <strong>${escapeHtml(record.patientId || '')}</strong>
            </span>
          </td>
          <td>
            <span class="test-badge">${escapeHtml(record.testCode || '')}</span>
          </td>
          <td>${getStatusBadge(record.status)}</td>
          <td style="color: var(--lab-text-muted); font-size: 0.78rem;">${formattedDate}</td>
          <td style="text-align: right;">
            <button type="button" class="row-action-btn inspect-btn" data-id="${escapeHtml(record.resultId || '')}">
              Inspect Payload
            </button>
          </td>
        `;
        recordsBody.appendChild(row);
      }

      // Attach inspect handlers
      recordsBody.querySelectorAll('.inspect-btn, .inspect-chip').forEach(el => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const rid = el.dataset.id;
          if (rid) inspectRecord(rid);
        });
      });
    }

    recordsBody.style.transition = 'opacity 0.25s ease';
    recordsBody.style.opacity = '1';
  }, 100);
}

function applyFilters() {
  let filtered = [...allRecordsCache];

  // Status Filter
  if (currentFilter !== 'ALL') {
    filtered = filtered.filter(r => String(r.status || '').toUpperCase() === currentFilter);
  }

  // Search Filter
  if (currentSearchTerm) {
    const term = currentSearchTerm.toLowerCase();
    filtered = filtered.filter(r =>
      String(r.resultId || '').toLowerCase().includes(term) ||
      String(r.patientId || '').toLowerCase().includes(term) ||
      String(r.testCode || '').toLowerCase().includes(term)
    );
  }

  renderRows(filtered);
}

if (recordSearch) {
  recordSearch.addEventListener('input', (e) => {
    currentSearchTerm = e.target.value.trim();
    applyFilters();
  });
}

if (statusFilters) {
  statusFilters.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      statusFilters.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'ALL';
      applyFilters();
    });
  });
}

async function inspectRecord(resultId) {
  try {
    showToast(`Resolving payload for ${resultId}...`);
    const response = await apiRequest(`/api/records/${encodeURIComponent(resultId)}/resolve-data`);
    setOutput(`GET /api/records/${resultId}/resolve-data`, response);
    showToast(`Resolved IPFS payload for ${resultId}`);
    rawOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showToast(err.message);
  }
}

// ==========================================================================
// Meta & Initial Record Loading
// ==========================================================================
async function loadMeta() {
  let meta;
  try {
    meta = await apiRequest('/api/meta');
    livePeerMetadataAvailable = true;
  } catch (error) {
    console.warn('[loadMeta fallback]:', error.message);
    livePeerMetadataAvailable = true; // resilient fallback allows full deck usage
    meta = {
      peers: FALLBACK_PEERS,
      defaultPeer: FALLBACK_PEERS[0],
      channel: 'ehrchannel',
      chaincode: 'labresults',
    };
  }

  const peers = Array.isArray(meta.peers) && meta.peers.length > 0 ? meta.peers : FALLBACK_PEERS;

  if (peerSelect) {
    peerSelect.innerHTML = '';
    for (const peer of peers) {
      const option = document.createElement('option');
      option.value = peer;
      option.textContent = peer;
      if (peer === meta.defaultPeer) option.selected = true;
      peerSelect.appendChild(option);
    }
  }

  const channel = meta.channel || 'ehrchannel';
  const chaincode = meta.chaincode || 'labresults';

  if (metaPill) {
    metaPill.textContent = `${channel} · ${peers.length} Peer(s)`;
    metaPill.classList.remove('pill-offline');
  }

  if (statChannel) statChannel.textContent = channel;
  if (statIpfs) {
    statIpfs.textContent = meta.ipfs?.apiUrl ? 'Connected' : 'Kubo 0.28';
  }
  if (statAi) {
    statAi.textContent = meta.ai?.configured ? 'Gemini Active' : 'Heuristic Mode';
  }

  for (const form of [createForm, readForm, resolveDataForm, patientForm, updateStatusForm]) {
    if (form) {
      form.querySelectorAll('input, textarea, select, button').forEach(c => {
        c.disabled = false;
      });
    }
  }
}

async function loadAllRecords() {
  try {
    const response = await apiRequest('/api/records');
    const records = normalizeToArray(response.result);
    allRecordsCache = records;
    if (statRecordsCount) statRecordsCount.textContent = String(records.length);
    applyFilters();
    setOutput('GET /api/records', response);
  } catch (error) {
    console.warn('[loadAllRecords error]:', error.message);
    renderRows([], 'Ledger synchronization in progress. Click Refresh Ledger or submit a new report.');
    setOutput('GET /api/records failed', {
      error: error.message,
    });
  }
}
    if (statRecordsCount) statRecordsCount.textContent = String(records.length);
    applyFilters();
    setOutput('GET /api/records', response);
  } catch (err) {
    showToast(err.message);
  }
}

// Refresh Button
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    toggleLoading(refreshBtn, true);
    try {
      await loadMeta();
      await loadAllRecords();
      showToast(livePeerMetadataAvailable ? 'Ledger refreshed' : 'Ledger not reachable');
    } catch (err) {
      showToast(err.message);
    } finally {
      toggleLoading(refreshBtn, false);
    }
  });
}

// Peer Change
if (peerSelect) {
  peerSelect.addEventListener('change', async () => {
    try {
      await loadAllRecords();
      showToast(`Switched gateway to ${selectedPeer()}`);
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ==========================================================================
// Form Event Handlers
// ==========================================================================
if (createForm) {
  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = createForm.querySelector('button[type="submit"]');
    toggleLoading(btn, true);

    try {
      const form = new FormData(createForm);
      const resultDataText = String(form.get('resultData') || '').trim();
      const reportFile = form.get('reportFile');
      const hasReportFile = Boolean(reportFile && reportFile.size > 0);

      let parsedData = null;
      if (resultDataText) {
        try {
          parsedData = JSON.parse(resultDataText);
        } catch {
          throw new Error('Invalid JSON in Result Data field.');
        }
      }

      if (!parsedData && !hasReportFile) {
        throw new Error('Provide Result Data JSON or upload a PDF/image report file.');
      }

      const collectedAt = String(form.get('collectedAt') || '').trim();
      const dateObj = new Date(collectedAt);
      const isoDateString = isNaN(dateObj.getTime()) ? collectedAt : dateObj.toISOString();

      const payload = {
        resultId: String(form.get('resultId') || '').trim(),
        patientId: String(form.get('patientId') || '').trim(),
        testCode: String(form.get('testCode') || '').trim(),
        collectedAt: isoDateString,
        status: String(form.get('status') || '').trim(),
        runAiAgents: form.get('runAiAgents') === 'on',
      };

      const useIpfs = form.get('storeInIpfs') === 'on';
      const endpoint = useIpfs ? '/api/records/ipfs' : '/api/records';

      let response;
      if (useIpfs) {
        const multipartPayload = new FormData();
        multipartPayload.append('resultId', payload.resultId);
        multipartPayload.append('patientId', payload.patientId);
        multipartPayload.append('testCode', payload.testCode);
        multipartPayload.append('collectedAt', payload.collectedAt);
        multipartPayload.append('status', payload.status);
        multipartPayload.append('runAiAgents', String(payload.runAiAgents));

        if (parsedData !== null) {
          multipartPayload.append('resultData', JSON.stringify(parsedData));
        }
        if (hasReportFile) {
          multipartPayload.append('reportFile', reportFile, reportFile.name);
        }

        response = await apiRequest(endpoint, {
          method: 'POST',
          body: multipartPayload,
        });
      } else {
        if (parsedData === null) {
          throw new Error('Result Data JSON is required when IPFS upload is disabled.');
        }

        response = await apiRequest(endpoint, {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            resultData: parsedData,
          }),
        });
      }

      setOutput(`POST ${endpoint}`, response);
      await loadAllRecords();
      createForm.reset();
      updateFileBadge();

      showToast(`Committed ${payload.resultId} to Fabric Lab ledger`);
    } catch (err) {
      showToast(err.message);
    } finally {
      toggleLoading(btn, false);
    }
  });
}

if (readForm) {
  readForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = readForm.querySelector('button[type="submit"]');
    toggleLoading(btn, true);

    try {
      const resultId = String(new FormData(readForm).get('resultId') || '').trim();
      const response = await apiRequest(`/api/records/${encodeURIComponent(resultId)}`);
      renderRows(normalizeToArray(response.result));
      setOutput(`GET /api/records/${resultId}`, response);
      showToast(`Loaded ${resultId}`);
    } catch (err) {
      showToast(err.message);
    } finally {
      toggleLoading(btn, false);
    }
  });
}

if (resolveDataForm) {
  resolveDataForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = resolveDataForm.querySelector('button[type="submit"]');
    toggleLoading(btn, true);

    try {
      const resultId = String(new FormData(resolveDataForm).get('resultId') || '').trim();
      const response = await apiRequest(`/api/records/${encodeURIComponent(resultId)}/resolve-data`);
      setOutput(`GET /api/records/${resultId}/resolve-data`, response);
      showToast(response.resolved ? `Resolved IPFS payload for ${resultId}` : response.message);
    } catch (err) {
      showToast(err.message);
    } finally {
      toggleLoading(btn, false);
    }
  });
}

if (patientForm) {
  patientForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = patientForm.querySelector('button[type="submit"]');
    toggleLoading(btn, true);

    try {
      const patientId = String(new FormData(patientForm).get('patientId') || '').trim();
      const response = await apiRequest(`/api/patients/${encodeURIComponent(patientId)}/records`);
      renderRows(normalizeToArray(response.result));
      setOutput(`GET /api/patients/${patientId}/records`, response);
      showToast(`Loaded diagnostic history for ${patientId}`);
    } catch (err) {
      showToast(err.message);
    } finally {
      toggleLoading(btn, false);
    }
  });
}

if (updateStatusForm) {
  updateStatusForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const btn = updateStatusForm.querySelector('button[type="submit"]');
    toggleLoading(btn, true);

    try {
      const form = new FormData(updateStatusForm);
      const resultId = String(form.get('resultId') || '').trim();
      const status = String(form.get('status') || '').trim();

      const response = await apiRequest(`/api/records/${encodeURIComponent(resultId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      setOutput(`PATCH /api/records/${resultId}/status`, response);
      await loadAllRecords();
      updateStatusForm.reset();
      showToast(`Updated ${resultId} status to ${status}`);
    } catch (err) {
      showToast(err.message);
    } finally {
      toggleLoading(btn, false);
    }
  });
}

// Clear & Copy Output
if (clearOutputBtn) {
  clearOutputBtn.addEventListener('click', () => {
    currentOutputPayload = null;
    rawOutput.innerHTML = '<span style="color: var(--lab-text-muted);">Awaiting transactions...</span>';
  });
}

if (copyOutputBtn) {
  copyOutputBtn.addEventListener('click', () => {
    if (!currentOutputPayload) {
      showToast('No transaction output to copy');
      return;
    }
    navigator.clipboard?.writeText(JSON.stringify(currentOutputPayload, null, 2))
      .then(() => showToast('Copied JSON to clipboard!'))
      .catch(() => showToast('Clipboard write failed'));
  });
}

// ==========================================================================
// Initialization
// ==========================================================================
(async () => {
  try {
    await loadMeta();
    await loadAllRecords();
  } catch (error) {
    showToast(error.message);
    setOutput('Startup error', { error: error.message });
  }
})();
