"""
RAG System for Medical Q&A - Fully Local with Patient Data

This module implements a Retrieval-Augmented Generation (RAG) system
for medical question answering using local LLMs, vector databases,
and an offline fallback engine for zero-download instant execution.
"""

import os
import json
import re
from typing import Dict, List, Any, Optional

try:
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain_community.vectorstores import Chroma
    from langchain_community.embeddings import HuggingFaceEmbeddings
    from langchain_community.llms import HuggingFacePipeline
    from langchain.chains import RetrievalQA
    from langchain.prompts import PromptTemplate
    import torch
    from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline
    HAS_NEURAL_DEPS = True
except ImportError:
    HAS_NEURAL_DEPS = False

from patient_manager import PatientManager

class MedicalRAG:
    """
    Medical RAG System with optimized retrieval and generation.
    
    Features:
    - Zero-download offline mode for instant startup and testing
    - Optional Local LLM (TinyLlama) & ChromaDB for full neural inference
    - MMR retrieval & keyword relevance scoring
    - Deterministic patient vector indexing with stale-chunk invalidation
    - Patient data integration and confidence scoring
    """
    
    def __init__(self, data_dir: str = "medical_data", offline_mode: Optional[bool] = None):
        """
        Initialize the Medical RAG system.
        
        Args:
            data_dir: Directory containing medical documents
            offline_mode: True to run purely offline without downloading neural models.
                         Defaults to True if EHR_OFFLINE_MODE is set or models are not pre-cached.
        """
        self.data_dir = data_dir
        
        if offline_mode is None:
            # Default to offline mode for zero-download fast startup unless explicitly disabled
            env_val = os.environ.get("EHR_OFFLINE_MODE", "true").strip().lower()
            self.offline_mode = env_val in ("1", "true", "yes")
        else:
            self.offline_mode = offline_mode

        self.embeddings = None
        self.vectorstore = None
        self.qa_chain = None
        self.llm = None
        self.patient_manager = PatientManager()
        self.raw_documents = []
        self._offline_docs = []
        
        if not self.offline_mode and HAS_NEURAL_DEPS:
            try:
                self.embeddings = HuggingFaceEmbeddings(
                    model_name="sentence-transformers/all-MiniLM-L6-v2"
                )
            except Exception as e:
                print(f"[WARN] Could not load neural embeddings ({e}). Falling back to offline mode.")
                self.offline_mode = True
        else:
            self.offline_mode = True

    def load_documents(self) -> List[str]:
        """
        Load medical documents and patient data from various sources.
        
        Returns:
            List of document strings
        """
        documents = []
        
        # Load PubMed articles
        json_file = os.path.join(self.data_dir, "pubmed_articles.json")
        if os.path.exists(json_file):
            with open(json_file, 'r', encoding='utf-8') as f:
                articles = json.load(f)
                
            for article in articles:
                text = f"Title: {article.get('title', '')}\n\n"
                text += f"Abstract: {article.get('abstract', '')}\n\n"
                text += f"Source: {article.get('source', '')}\n"
                text += f"URL: {article.get('url', '')}"
                documents.append(text)
        
        # Load patient data
        patient_summaries = self.patient_manager.get_all_patient_summaries()
        for summary in patient_summaries:
            documents.append(f"PATIENT RECORD:\n{summary}")
        
        self.raw_documents = documents
        return documents
    
    def create_vectorstore(self) -> None:
        """
        Create vector store with optimized chunking strategy or offline index.
        """
        print("Loading documents...")
        documents = self.load_documents()
        
        if not documents:
            documents = [
                "EHR SYSTEM INITIALIZATION:\n"
                "Medical knowledge base initialized. No patient records or PubMed articles loaded yet.\n"
                "Add patients through the dashboard or run data_collector.py to index PubMed literature."
            ]
        
        print(f"Loaded {len(documents)} documents")
        self._offline_docs = list(documents)
        
        if not self.offline_mode and HAS_NEURAL_DEPS and self.embeddings is not None:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=300,
                chunk_overlap=100,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
            texts = text_splitter.create_documents(documents)
            print(f"Creating vector store with {len(texts)} chunks...")
            self.vectorstore = Chroma.from_documents(
                documents=texts,
                embedding=self.embeddings,
                persist_directory="./chroma_db"
            )
            print("Vector store created!")
        else:
            print("[OFFLINE] Offline clinical index initialized (Zero downloads).")

    def add_patient_record(self, patient_id: str, summary: str) -> None:
        """
        Incrementally add/upsert a patient record to the vector store.
        Avoids full vectorstore reconstruction (O(1) incremental addition)
        and uses deterministic chunk IDs to eliminate duplicate and stale records.
        
        Args:
            patient_id: Patient unique identifier
            summary: Formatted clinical summary text
        """
        text = f"PATIENT RECORD:\n{summary}"
        
        # Always maintain in offline documents list
        # Remove previous versions for this patient
        self._offline_docs = [
            doc for doc in self._offline_docs 
            if f"Patient ID: {patient_id}\n" not in doc
        ]
        self._offline_docs.append(text)
        
        if not self.offline_mode and HAS_NEURAL_DEPS and self.vectorstore is not None:
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=300,
                chunk_overlap=100,
                separators=["\n\n", "\n", ". ", " ", ""]
            )
            texts = text_splitter.create_documents(
                [text],
                metadatas=[{"patient_id": patient_id, "type": "patient_record"}]
            )
            ids = [f"patient_{patient_id}_chunk_{i}" for i in range(len(texts))]
            
            try:
                if hasattr(self.vectorstore, "delete"):
                    self.vectorstore.delete(ids=ids)
            except Exception:
                pass
                
            self.vectorstore.add_documents(texts, ids=ids)
            if hasattr(self.vectorstore, "persist"):
                self.vectorstore.persist()
        else:
            if not self._offline_docs:
                self.create_vectorstore()

    def load_local_llm(self) -> None:
        """Load and configure local LLM with optimized parameters."""
        if self.offline_mode or not HAS_NEURAL_DEPS:
            print("[OFFLINE] Using structured clinical offline synthesizer (Zero downloads).")
            return
            
        print("Loading local LLM (this may take a few minutes first time)...")
        model_name = "TinyLlama/TinyLlama-1.1B-Chat-v1.0"
        
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else None,
            low_cpu_mem_usage=True
        )
        
        pipe = pipeline(
            "text-generation",
            model=model,
            tokenizer=tokenizer,
            max_new_tokens=200,
            temperature=0.2,
            top_p=0.9,
            top_k=40,
            repetition_penalty=1.2,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
        
        self.llm = HuggingFacePipeline(pipeline=pipe)
        print("Local LLM loaded!")

    def setup_qa_chain(self) -> None:
        """
        Setup QA chain with advanced retrieval or offline clinical engine.
        """
        if self.offline_mode or not HAS_NEURAL_DEPS:
            if not self._offline_docs:
                self.load_documents()
                self._offline_docs = list(self.raw_documents)
            print("[OFFLINE] QA Chain initialized in offline clinical mode.")
            return

        if not self.vectorstore:
            if os.path.exists("./chroma_db"):
                try:
                    print("Loading existing Chroma vector store from ./chroma_db...")
                    self.vectorstore = Chroma(
                        persist_directory="./chroma_db",
                        embedding_function=self.embeddings
                    )
                except Exception as e:
                    print(f"Could not load existing vector store ({e}). Rebuilding...")
                    self.create_vectorstore()
            else:
                self.create_vectorstore()
        
        if not self.llm:
            self.load_local_llm()
        
        prompt_template = """<|system|>
You are an expert medical AI assistant. Provide accurate, concise, and evidence-based answers.
Use ONLY the provided context. If information is not in the context, say so clearly.
For patient data, cite specific measurements and values.</s>
<|user|>
Context Information:
{context}

Question: {question}

Instructions:
- Answer directly and concisely
- Use specific data from context
- For patient queries, mention exact values
- If uncertain, state limitations</s>
<|assistant|>
"""
        PROMPT = PromptTemplate(
            template=prompt_template,
            input_variables=["context", "question"]
        )
        
        retriever = self.vectorstore.as_retriever(
            search_type="mmr",
            search_kwargs={
                "k": 5,
                "fetch_k": 10,
                "lambda_mult": 0.7
            }
        )
        
        self.qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            chain_type_kwargs={"prompt": PROMPT},
            return_source_documents=True
        )

    def _offline_query_search(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Perform semantic and keyword search across local documents."""
        if not self._offline_docs:
            self.load_documents()
            self._offline_docs = list(self.raw_documents)
            
        terms = [t.lower() for t in re.findall(r'\b\w{3,}\b', query)]
        scored = []
        for doc in self._offline_docs:
            doc_lower = doc.lower()
            score = sum(doc_lower.count(t) for t in terms)
            # Boost patient records if patient/id is queried
            if "patient" in terms and "patient record:" in doc_lower:
                score += 5
            for t in terms:
                if t in doc_lower:
                    score += 2
            if score > 0:
                scored.append((score, doc))
        
        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for score, doc in scored[:top_k]]

    def ask(self, question: str) -> Dict[str, Any]:
        """
        Ask a question and get an answer with sources and confidence.
        
        Args:
            question: User's question
            
        Returns:
            Dictionary containing answer, sources, and confidence score.
        """
        # Offline mode or neural dependencies not initialized
        if self.offline_mode or not self.qa_chain:
            matching_docs = self._offline_query_search(question, top_k=3)
            
            if not matching_docs:
                return {
                    "answer": "No relevant medical records or PubMed articles were found in the local knowledge base matching your query.",
                    "sources": [],
                    "confidence": "Low"
                }
            
            # Synthesize answer from top context
            top_doc = matching_docs[0]
            answer_lines = []
            
            if "PATIENT RECORD:" in top_doc:
                answer_lines.append("Clinical data retrieved for the requested patient:")
                for line in top_doc.split("\n"):
                    if line.strip() and not line.startswith("PATIENT RECORD:"):
                        answer_lines.append(f"• {line}")
            else:
                # Extract abstract/guideline snippet
                if "Abstract:" in top_doc:
                    parts = top_doc.split("Abstract:")
                    abstract_text = parts[1].split("Source:")[0].strip()
                    answer_lines.append(abstract_text)
                else:
                    answer_lines.append(top_doc[:400].strip())

            answer = "\n".join(answer_lines)
            sources = [doc[:200] + "..." for doc in matching_docs]
            confidence = "High" if len(matching_docs) >= 2 else "Medium"
            
            return {
                "answer": answer,
                "sources": sources,
                "confidence": confidence
            }

        # Neural LLM Chain Branch
        enhanced_question = self._enhance_query(question)
        result = self.qa_chain({"query": enhanced_question})
        answer = self._clean_answer(result["result"])
        
        return {
            "answer": answer,
            "sources": [doc.page_content[:200] + "..." for doc in result["source_documents"]],
            "confidence": self._calculate_confidence(result["source_documents"])
        }
    
    def _enhance_query(self, question: str) -> str:
        """Enhance query for better retrieval."""
        question = question.strip()
        if not question.endswith('?'):
            question += '?'
        return question
    
    def _clean_answer(self, answer: str) -> str:
        """Clean and format the generated answer."""
        lines = answer.split('\n')
        seen = set()
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            if line and line not in seen:
                seen.add(line)
                cleaned_lines.append(line)
        
        answer = '\n'.join(cleaned_lines)
        if answer and not answer[-1] in '.!?':
            sentences = answer.split('.')
            if len(sentences) > 1:
                answer = '.'.join(sentences[:-1]) + '.'
        
        return answer.strip()
    
    def _calculate_confidence(self, source_docs: List) -> str:
        """Calculate confidence score based on retrieved sources."""
        if not source_docs:
            return "Low"
        if len(source_docs) >= 3:
            return "High"
        elif len(source_docs) >= 2:
            return "Medium"
        else:
            return "Low"

if __name__ == "__main__":
    rag = MedicalRAG()
    rag.setup_qa_chain()
    result = rag.ask("What is diabetes mellitus?")
    print(f"Answer:\n{result['answer']}")
    print(f"Confidence: {result['confidence']}")
