from clinical_node import clinical_node


mock_state = {

    "patient_id": "P001",

    "lab_result": {

        "hemoglobin": 9.2,
        "mcv": 72,
        "ferritin": 18

    },

    "history_result": {

        "age": 35,
        "symptoms": [
            "fatigue",
            "weakness"
        ],

        "medical_history": [
            "No known chronic illness"
        ]

    }
}


def test_clinical_node():
    result = clinical_node(mock_state)
    assert result["clinical_result"] is not None
    assert "Hematologic & Anemia Evaluation Tool" in result["clinical_result"].toolsExecuted


if __name__ == "__main__":
    result = clinical_node(mock_state)
    print("\n==============================")
    print("CLINICAL AGENT RESULT")
    print("==============================")
    print(result["clinical_result"])