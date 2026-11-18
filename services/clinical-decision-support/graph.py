from langgraph.graph import StateGraph, START, END

from state import ClinicalState
from mock_agents import lab_agent, history_agent
from clinical_node import clinical_node, disease_tools_node


def build_graph():
    """
    Compiles the multi-agent clinical decision support workflow:
    START -> lab_agent -> history_agent -> disease_tools -> clinical_agent -> END
    """
    graph = StateGraph(ClinicalState)

    # Add workflow nodes
    graph.add_node("lab_agent", lab_agent)
    graph.add_node("history_agent", history_agent)
    graph.add_node("disease_tools", disease_tools_node)
    graph.add_node("clinical_agent", clinical_node)

    # Define sequential edges
    graph.add_edge(START, "lab_agent")
    graph.add_edge("lab_agent", "history_agent")
    graph.add_edge("history_agent", "disease_tools")
    graph.add_edge("disease_tools", "clinical_agent")
    graph.add_edge("clinical_agent", END)

    return graph.compile()