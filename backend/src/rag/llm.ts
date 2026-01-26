import axios from "axios";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant"; // FREE tier

type RetrievedChunk = {
  text: string;
  score?: number;
  source_file?: string;
};

/**
 * Generate grounded answer using Groq LLM
 * STRICTLY document-based, but allows summarization across chunks
 */
export async function generateLLMAnswer(
  question: string,
  chunks: RetrievedChunk[]
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

  // 2️⃣ FINAL balanced grounding + synthesis-aware prompt
  const systemPrompt = `
You are a highly precise, document-grounded assistant.

Your task is to answer the user's question using ONLY the provided context.

CORE RULES (must always be followed):
1. Use ONLY the information present in the context chunks.
2. You MAY combine and reason across multiple chunks.
3. Do NOT introduce any external knowledge.
4. Do NOT invent facts, data, methods, or results.

ANSWERING RULES:
5. If the question is a FACTUAL question (e.g., asking for a specific method,
   number, result, or claim), and the context does NOT contain enough information,
   respond EXACTLY with:
   "The uploaded documents do not contain this information."

6. If the question is a DESCRIPTIVE or SUMMARY question (e.g., "describe",
   "summarize", "give an overview of the document/paper/pdf"):
   - You MAY infer the document’s overall theme, purpose, and scope
     by synthesizing information across multiple chunks.
   - Do NOT add details that are not supported by the context.
   - Stay at a high level if specifics are not present.

QUALITY GUIDELINES:
7. Answer in a clear, well-structured manner.
8. Prefer explanation over short fragments.
9. If helpful, structure the answer as:
   - Overview
   - Key points or approach
   - Additional details (if present in context)

SPECIAL CASE — COMMON ACADEMIC QUESTIONS:
10. If the question asks about:
    - objective
    - goal
    - purpose
    - motivation
    - problem statement
    summarize the intent described across the document,
    even if phrased differently in different chunks.

Tone:
- Professional
- Neutral
- Informative
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
        temperature: 0.1,
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
