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


result = clinical_node(mock_state)


print("\n==============================")
print("CLINICAL AGENT RESULT")
print("==============================")

print(result["clinical_result"])