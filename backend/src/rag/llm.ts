import axios from "axios";
import type { RAGChunk, PerDocumentAnswer } from "../types";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant"; // FREE tier

/**
 * Generate grounded answer using Groq LLM
 * STRICTLY document-based, but allows summarization across chunks
 */
export async function generateLLMAnswer(
  question: string,
  chunks: RAGChunk[]
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  if (!chunks || chunks.length === 0) {
    return "The uploaded documents do not contain this information.";
  }

  // 1️⃣ Build context (ordered, compact)
  const context = chunks
    .map(
      (chunk, index) =>
        `Chunk ${index + 1}:\n${chunk.text}`
    )
    .join("\n\n");

  // 2️⃣ FINAL balanced grounding + STRUCTURED EXTRACTION prompt
  const systemPrompt = `
You are a highly precise, document-grounded assistant.

Your task is to answer the user's question using ONLY the provided context.

CORE RULES (must always be followed):
1. Use ONLY the information present in the context chunks.
2. NEVER infer, guess, assume, or generalize.
3. NEVER introduce external knowledge.
4. If information is not explicitly present, you must say so.

CRITICAL: WHAT COUNTS AS "EXPLICIT INFORMATION":
Explicit information is NOT limited to full sentences.
You MUST extract information if it appears in:
- Section headings
- Bullet points
- Numbered lists
- Tables
- Comma-separated lists (e.g., "Skills: Java, Python, React")
- Fragmented phrases (technical keywords)
- Unstructured text blocks that imply a list (e.g., "Tech Stack using React Node Mongo")

If information exists in ANY of these forms, EXTRACT IT.
Do NOT filter out valid skills just because they lack a bullet point.

RELEVANCE FILTERS (Strict):
When the user asks for "Skills", "Technologies", or "Stack":
1. INCLUDE: Programming languages, frameworks, libraries, databases, tools, platforms, hardware, cloud services.
2. EXCLUDE: 
   - Education degrees (B.Tech, M.Sc, PhD)
   - Academic majors (Computer Science, Electronics)
   - Institutes/University names
   - Soft skills (Leadership, Communication)
   - General nouns (Computer, Application, Software, Project)

RESPONSE FORMAT (Structured Markdown):
For "list skills" or "technologies" questions, you MUST organize the answer into these categories (if applicable):

### Programming Languages
- (e.g., C, Python, Java)

### Frameworks & Libraries
- (e.g., React, Express, Pandas)

### Databases
- (e.g., MongoDB, SQLite)

### Tools & Platforms
- (e.g., VS Code, Docker, AWS, Firebase)

### Hardware / IoT
- (e.g., Arduino, ESP32)

### Version Control
- (e.g., Git, GitHub)

(If a captured item does not fit these categories, place it under "### Domains / Concepts").
Do NOT output a simple flat bullet list unless explicitly requested.

NO INFERENCE POLICY (CLARIFIED):
- You CANNOT invent facts.
- You CAN infer structure from messy text (e.g., if you see "Java Python C++", treat it as a list).
- The following phrases remain FORBIDDEN: "suggests that", "implies that", "likely".

FAIL-SAFE RESPONSE:
Use the fallback response ONLY IF the requested information does not exist in any form.
EXACT fallback response:
"The uploaded documents do not contain this information."

ANSWERING RULES:
1. Extract text EXACTLY as written (but separate comma-separated items).
2. Do NOT reword items.
3. Clean up list artifacts.

SUMMARY MODE:
- Be factual. Be concise. Structure with clear headers if covering multiple topics.

Tone:
- Professional
- Neutral
- Structured
`;

  // 3️⃣ User prompt
  const userPrompt = `
Context:
${context}

Question:
${question}
`;

  // 4️⃣ Call Groq LLM
  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1, // Keep low for deterministic structure
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const answer = response.data.choices[0].message.content?.trim();

    if (!answer || answer.length === 0) {
      return "The uploaded documents do not contain this information.";
    }

    return answer;
  } catch (err: any) {
    console.error("❌ Groq LLM Error");

    if (err.response) {
      console.error("Status:", err.response.status);
      console.error(
        "Data:",
        JSON.stringify(err.response.data, null, 2)
      );
    } else {
      console.error("Message:", err.message);
    }

    throw err;
  }
}

/**
 * Merge multiple per-document answers into a final consolidated response
 * Used in the Reduce phase of Map-Reduce RAG
 * 
 * CRITICAL: This function receives ALL per-document answers (including "not found" ones)
 * The LLM must intelligently synthesize only the relevant information
 */
export async function mergeLLMAnswers(
  question: string,
  perDocAnswers: PerDocumentAnswer[]
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not configured");
  }

  if (!perDocAnswers || perDocAnswers.length === 0) {
    return "The uploaded documents do not contain this information.";
  }

  // ========================================
  // ENFORCEMENT: Log what we received
  // ========================================
  console.log(`[REDUCE/MERGE] Received ${perDocAnswers.length} per-document answers`);
  perDocAnswers.forEach((item, idx) => {
    const preview = item.answer.substring(0, 80).replace(/\n/g, ' ');
    console.log(`[REDUCE/MERGE] Doc ${idx + 1} (${item.source_file}): "${preview}..."`);
  });

  // If only one document answer, return it directly
  if (perDocAnswers.length === 1) {
    console.log(`[REDUCE/MERGE] Single document, returning directly`);
    return perDocAnswers[0].answer;
  }

  // Build context from ALL per-document answers (no filtering)
  const context = perDocAnswers
    .map(
      (item, index) =>
        `Document ${index + 1} (${item.source_file || item.doc_id}):\n${item.answer}`
    )
    .join("\n\n");

  const systemPrompt = `
You are a highly precise assistant that synthesizes information from multiple documents.

CRITICAL INSTRUCTIONS - HARD ENFORCED:
1. You are receiving answers from ${perDocAnswers.length} different documents
2. Each document was analyzed independently in the MAP phase
3. Your job is to create a COHERENT synthesis in this REDUCE phase
4. Include information from ALL documents that contain relevant answers
5. If a document says "not found" or "does not contain", SKIP it in synthesis
6. DO NOT choose a "most comprehensive" document - MERGE all relevant information
7. DO NOT introduce any external knowledge
8. Maintain source attribution when merging

FORBIDDEN BEHAVIORS:
- Selecting only one document's answer when multiple have information
- Ignoring documents without clear justification
- Adding information not present in the per-document answers
- Choosing a "best" or "most detailed" document instead of merging

SYNTHESIS RULES:
- If multiple documents answer the question, COMBINE their insights
- Preserve unique information from each document
- Create a unified, coherent response
- If documents contradict, mention both perspectives

Tone: Professional, Neutral, Informative
`;

  const userPrompt = `
Per-Document Answers (from MAP phase):
${context}

Original Question:
${question}

Your task:
1. Identify which documents actually answered the question (ignore "not found" responses)
2. If only ONE document answered, return that answer
3. If MULTIPLE documents answered, SYNTHESIZE them into a coherent response
4. DO NOT select a "most comprehensive" document - MERGE all relevant information
5. Preserve attribution when useful

Provide a clear, synthesized response based on ALL relevant documents:
`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    const answer = response.data.choices[0].message.content?.trim();

    if (!answer || answer.length === 0) {
      return "The uploaded documents do not contain this information.";
    }

    console.log(`[REDUCE/MERGE] Generated merged answer: ${answer.length} chars`);
    return answer;
  } catch (err: any) {
    console.error("❌ Groq LLM Merge Error");

    if (err.response) {
      console.error("Status:", err.response.status);
      console.error(
        "Data:",
        JSON.stringify(err.response.data, null, 2)
      );
    } else {
      console.error("Message:", err.message);
    }

    throw err;
  }
}

