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

  // 2️⃣ STRONG grounding + summarization-aware system prompt
  const systemPrompt = `
You are a document-grounded assistant.

Rules you MUST follow:
1. Use ONLY the provided context.
2. The answer may be spread across multiple chunks.
3. If the question asks about:
   - objective
   - goal
   - purpose
   - motivation
   - problem statement
   you MUST summarize the intent described in the document.
4. Do NOT require exact wording to answer.
5. Do NOT use outside knowledge.
6. If and ONLY IF the context truly does not discuss the topic,
   respond exactly with:
   "The uploaded documents do not contain this information."
7. Be clear, concise, and factual.
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
        temperature: 0.1, // lower = more factual
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
