"""
Phase 1 & 2 Structure & Integrity Verification Script (Python Workspace Focused)

Validates:
1. Python Medical RAG workspace structure, hygiene rules, and documentation.
2. Isolated non-destructive smoke test for PatientManager data serialization.
3. Optional read-only audit of external Fabric repository if --fabric-repo is supplied.

Usage:
    python tests/test_structure_integrity.py
    python tests/test_structure_integrity.py --fabric-repo <path>
"""

import os
import sys
import argparse

def parse_args():
    parser = argparse.ArgumentParser(
        description="Verify Phase 1 structure and workspace hygiene."
    )
    parser.add_argument(
        "--rag-workspace",
        default=os.environ.get("EHR_RAG_WORKSPACE"),
        help="Path to the Python Medical RAG workspace directory (defaults to parent of this test file)."
    )
    parser.add_argument(
        "--fabric-repo",
        default=os.environ.get("EHR_FABRIC_REPO"),
        help="Optional path to external Fabric repository for read-only existence checks."
    )
    parser.add_argument(
        "--skip-behavior-check",
        action="store_true",
        help="Skip the isolated runtime schema serialization check and only run structure audits."
    )
    return parser.parse_args()

def verify_rag_workspace_structure(workspace: str) -> bool:
    print(f"\n[1/2] Auditing Python RAG Workspace Structure:")
    print(f"      Path: {workspace}")
    
    if not os.path.isdir(workspace):
        raise FileNotFoundError(f"Python RAG workspace directory does not exist: {workspace}")

    required_files = [
        "rag_system.py",
        "patient_manager.py",
        "data_collector.py",
        "app.py",
        "patient_demo.py",
        "requirements.txt",
        ".gitignore",
        ".env.example",
        "README.md",
        "EXISTING_WORK_DOCUMENT.md"
    ]
    
    for filename in required_files:
        filepath = os.path.join(workspace, filename)
        if not os.path.isfile(filepath):
            raise AssertionError(f"Required file missing from RAG workspace: {filename}")
        print(f"      [PASS] File verified: {filename}")

    required_dirs = [
        os.path.join("docs", "architecture"),
        os.path.join("docs", "api"),
        os.path.join("docs", "setup"),
        os.path.join("docs", "agents"),
        os.path.join("docs", "audit-reports"),
        "tests"
    ]

    for dirname in required_dirs:
        dirpath = os.path.join(workspace, dirname)
        if not os.path.isdir(dirpath):
            raise AssertionError(f"Required directory missing from RAG workspace: {dirname}")
        print(f"      [PASS] Directory verified: {dirname}")

    # Verify .gitignore contains hygiene rules
    gitignore_path = os.path.join(workspace, ".gitignore")
    with open(gitignore_path, "r", encoding="utf-8") as f:
        gitignore_content = f.read()
    assert ".env" in gitignore_content, ".env must be ignored in .gitignore"
    assert "!*.env.example" in gitignore_content, "!*.env.example must be preserved in .gitignore"
    print("      [PASS] Gitignore hygiene rules verified.")
    return True

def run_isolated_patient_manager_smoke_test(workspace: str) -> bool:
    print(f"\n[2/2] Running Isolated PatientManager Functional Smoke Test:")
    
    if workspace not in sys.path:
        sys.path.insert(0, workspace)
        
    try:
        from patient_manager import PatientManager
    except ImportError as e:
        raise ImportError(f"Cannot import PatientManager from {workspace}: {e}")

    test_dir = os.path.join(workspace, "tests", "_portable_test_temp")
    os.makedirs(test_dir, exist_ok=True)
    try:
        pm = PatientManager(data_dir=test_dir)
        added = pm.add_patient("PORTABLE_01", "Audit Test Subject", 35, "Female")
        if not added:
            raise AssertionError("Failed to add test patient to temporary storage.")
            
        meas = pm.add_measurements("PORTABLE_01", {"Blood Pressure": "118/78 mmHg", "Heart Rate": "70 bpm"})
        if not meas:
            raise AssertionError("Failed to add measurements to temporary storage.")
            
        summary = pm.get_patient_summary("PORTABLE_01")
        if not summary or "118/78 mmHg" not in summary:
            raise AssertionError(f"Summary does not contain expected measurement: {summary}")
            
        print("      [PASS] PatientManager serialization, storage, and summary generation verified.")
        return True
    finally:
        json_file = os.path.join(test_dir, "patients.json")
        if os.path.exists(json_file):
            os.remove(json_file)
        if os.path.exists(test_dir):
            os.rmdir(test_dir)

def verify_optional_fabric_repo(repo_path: str):
    print(f"\n[OPTIONAL] Auditing External Fabric Repository (Read-Only Existence):")
    print(f"           Path: {repo_path}")
    
    if not os.path.isdir(repo_path):
        print(f"           [WARN] Fabric repository path not found: {repo_path}")
        return

    lab_gateway = os.path.join(
        repo_path, "orgs", "lab", "EHR-LABORG-main", "client", "node-gateway"
    )
    if os.path.isdir(lab_gateway):
        print(f"           [PASS] Lab gateway found at: {lab_gateway}")
        for f in ["server.js", "gateway.js", "ipfs.js", "report-extractor.js", "ai-agent.js"]:
            p = os.path.join(lab_gateway, f)
            status = "PASS" if os.path.isfile(p) else "MISSING"
            print(f"           [{status}] Lab file: {f}")
    else:
        print(f"           [WARN] Lab gateway directory not found: {lab_gateway}")

def main():
    args = parse_args()

    rag_workspace = args.rag_workspace
    if not rag_workspace:
        rag_workspace = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    print("=" * 70)
    print("STRUCTURE & INTEGRITY VERIFICATION (WORKSPACE FOCUSED)")
    print("=" * 70)

    try:
        # 1. Python RAG Workspace Structure & Hygiene
        verify_rag_workspace_structure(rag_workspace)

        # 2. Isolated behavior smoke test
        if not args.skip_behavior_check:
            run_isolated_patient_manager_smoke_test(rag_workspace)
        else:
            print("\n[2/2] Behavior smoke test skipped by --skip-behavior-check flag.")

        # 3. Optional external repo check if requested
        if args.fabric_repo:
            verify_optional_fabric_repo(args.fabric_repo)

        print("\n" + "=" * 70)
        print("ALL WORKSPACE AUDIT CRITERIA SATISFIED [STATUS: PASS]")
        print("=" * 70)
        sys.exit(0)

    except Exception as err:
        print(f"\n[AUDIT FAILURE] {err}", file=sys.stderr)
        print("=" * 70, file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
