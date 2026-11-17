# 🏥 Clinical AI Agent & Medical RAG Microservice

Production-grade, autonomous Clinical Intelligence, Vital Signs Trend Analysis, and Retrieval-Augmented Generation (RAG) subsystem designed for the Decentralized Electronic Health Record (EHR) Federation.

---

## 🎯 System Capabilities

1. **Deterministic Clinical Governance & Anomaly Detection:**
   - Evaluates real-time patient vitals against medical guidelines.
   - Automatically detects Hypertensive Crisis, Stage 2 Hypertension, Hypoxemia ($SpO_2 < 90\%$), Hypoglycemia, and Tachycardia.
   - Computes historical trajectory deltas across sequential patient visits.

2. **Evidence-Based Medical RAG (Retrieval-Augmented Generation):**
   - Hybrid semantic and keyword indexing across curated PubMed clinical literature.
   - Cites exact scientific source abstracts and confidence levels (High/Medium/Low).
   - Contextualizes literature queries with the specific patient's active vital signs.

3. **Dual Interface (REST API & Web Dashboard):**
   - **FastAPI Backend (`main.py`):** Fully documented REST API (`/docs`) for programmatic integration with the Node.js Lab Gateway (`server.js`) and Hospital EHR.
   - **Gradio Dashboard (`app.py`):** Interactive clinician web portal for real-time question answering, patient registration, and vital trend visualization.

4. **Zero-Download Offline Execution:**
   - Instant startup with zero mandatory weight downloads.
   - Fully isolated inside `services/ai-agent/`.

---

## 🏗️ Production Microservice Architecture

```
services/ai-agent/
├── main.py                     # Microservice entry point (FastAPI + CORS)
├── app.py                      # Interactive Gradio Web Dashboard
├── requirements.txt            # Dependency specification
├── .env.example                # Environment variables template
├── .gitignore                  # Git exclusions (.venv, caches, vector db)
│
├── core/
│   ├── config.py               # Settings & clinical governance thresholds
│   └── logger.py               # Structured logging
│
├── schemas/
│   └── clinical.py             # Pydantic v2 data models with strict validation
│
├── services/
│   ├── patient_service.py      # Thread-safe patient repository with atomic writes
│   ├── trend_analyzer.py       # Deterministic clinical rule engine & trajectory
│   └── rag_engine.py           # Hybrid retrieval, PubMed corpus, & report analysis
│
├── api/
│   └── routes.py               # Documented REST API endpoints
│
├── medical_data/
│   └── pubmed_articles.json    # Curated clinical literature corpus
│
├── patient_data/
│   └── patients.json           # Atomic JSON patient store
│
└── tests/
    ├── test_patient_service.py # Repository & atomic write tests
    ├── test_trend_analyzer.py  # Anomaly & clinical governance tests
    ├── test_api_endpoints.py   # REST API integration tests
    └── test_phase3_stabilization.py # Baseline compatibility suite
```

---

## 🚀 Execution & Usage

### 1. Run the REST API Server (For Blockchain & Node.js Gateway)
```powershell
python main.py
```
* **API Server:** `http://localhost:8000`
* **Interactive Swagger Documentation:** `http://localhost:8000/docs`
* **ReDoc Documentation:** `http://localhost:8000/redoc`

#### Key API Endpoints:
| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/health` | Health check & system diagnostics |
| `POST` | `/api/v1/patients` | Register new patient profile |
| `GET` | `/api/v1/patients` | List all registered patients |
| `GET` | `/api/v1/patients/{id}` | Retrieve patient profile & historical vitals |
| `POST` | `/api/v1/patients/{id}/vitals` | Record new vitals & get immediate risk alerts |
| `GET` | `/api/v1/patients/{id}/trends` | Retrieve trajectory deltas & clinical alerts |
| `POST` | `/api/v1/agent/query` | RAG clinical literature Q&A with citations |
| `POST` | `/api/v1/agent/analyze-report` | Parse lab report text & compute provenance hash |

---

### 2. Run the Interactive Web Dashboard
```powershell
python app.py
```
* Starts the clinician dashboard on `http://localhost:7860`.

---

### 3. Run Automated Test Suite
```powershell
python -m pytest tests/ -v
```
All 14 unit and integration tests pass with zero warnings in $< 0.5$s.
