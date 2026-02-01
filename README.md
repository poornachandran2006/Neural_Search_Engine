# Neural Search Engine – Multi-Document RAG System

Neural Search Engine is a full-stack, production-grade Retrieval-Augmented Generation (RAG) system designed to demonstrate real-world document intelligence, multi-document reasoning, and safe LLM integration. The system supports strict document scoping, deterministic intent detection, and a Map-Reduce RAG pipeline for accurate cross-document answers.

This project is intentionally built to behave conservatively: it answers only when information is explicitly present in the documents and returns a clear “not found” response otherwise.

---

## Key Capabilities

• Semantic document search using dense embeddings  
• Vector storage and retrieval via Qdrant  
• Current Document and All Documents query modes  
• Map-Reduce RAG for multi-document reasoning  
• Deterministic intent routing (metadata vs content queries)  
• Hallucination-resistant response logic  
• File deduplication and ingestion locking  
• ChatGPT-style frontend with persistent chat history  

---

## Architecture Overview

Frontend (Next.js)  
→ Backend API (Node.js + Express)  
→ Embedding Service  
→ Vector Search (Qdrant)  
→ RAG Pipeline (Map → Reduce → Answer)  

The backend enforces strict scoping rules:
• Current Document mode queries only one document
• All Documents mode balances retrieval across all documents
• Map-Reduce is automatically applied when multiple documents are involved

---

## Project Structure

neural_search_engine/
├── backend/ # API, RAG logic, intent detection
├── frontend-next/ # Primary Next.js frontend
├── ingestion/ # Python ingestion pipeline
├── infra/ # Infrastructure and Docker configs
├── docs/ # Documentation assets
├── README.md
└── .gitignore

---

## Tech Stack

Backend  
• Node.js + TypeScript  
• Express  
• Qdrant Vector Database  
• LLM API (pluggable)  

Frontend  
• Next.js 14 (App Router)  
• TypeScript  
• Tailwind CSS  

Ingestion  
• Python  
• PDF/Text loaders  
• Chunking with overlap  
• Vector upserts to Qdrant  

---

## Query Modes

### Current Document Mode
• Query is scoped to a single selected document  
• Prevents cross-document leakage  
• Requires an explicitly selected document  

### All Documents Mode
• Searches across all uploaded documents  
• Ensures balanced retrieval per document  
• Uses Map-Reduce RAG when multiple documents exist  

---

## Safety & Correctness Guarantees

✔ Answers only when information exists in documents  
✔ Explicit “not found” responses when missing  
✔ No hallucinated summaries  
✔ No silent assumptions  
✔ Deterministic behavior for identical queries  
✔ Safe handling of ambiguous prompts  

---

## Local Setup Instructions

### 1. Clone the Repository
```bash
git clone https://github.com/poornachandran2006/Neural_Search_Engine.git
cd Neural_Search_Engine

2. Start Qdrant (Docker Required)
docker run -p 6333:6333 qdrant/qdrant

3. Backend Setup
cd backend
npm install
npm run dev

4. Ingestion Pipeline
cd ingestion
python src/main.py --file path/to/your/document.pdf

5. Frontend Setup
cd frontend-next
npm install
npm run dev


Open the application at:

http://localhost:3000

Environment Variables
Backend (backend/.env)
OPENAI_API_KEY=your_api_key
QDRANT_URL=http://localhost:6333

Frontend (frontend-next/.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000

Verified Behavior

• Current Document queries only use selected document
• All Documents queries correctly merge information
• Map-Reduce activates only when required
• Metadata queries bypass embeddings and LLM
• Resume and policy documents behave independently
• Queries like “compare”, “summarize”, and “list documents” work deterministically

Why This Project Matters

This system demonstrates real-world RAG engineering:
• Multi-document reasoning
• Controlled LLM usage
• Safe retrieval pipelines
• End-to-end system design
