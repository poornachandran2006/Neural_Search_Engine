/**
 * Shared constants for the RAG system
 */

/**
 * Phrases that indicate the LLM couldn't find an answer
 */
export const FALLBACK_PHRASES = [
    "do not contain",
    "i don't know",
    "cannot find",
    "no information",
] as const;

/**
 * Default minimum retrieval score
 */
export const DEFAULT_MIN_SCORE = 0.15;

/**
 * Invalid name patterns for resume extraction fallback
 */
export const INVALID_NAME_PATTERNS = [
    "SQL",
    "HTML",
    "CSS",
    "JAVA",
    "PYTHON",
    "JAVASCRIPT",
    "REACT",
    "NODE",
    "API",
    "HTTP",
    "JSON",
] as const;

/**
 * Check if answer contains fallback phrases
 */
export function isAnswerNotFound(answer: string): boolean {
    if (!answer) return true;
    const lowerAnswer = answer.toLowerCase();
    return FALLBACK_PHRASES.some((phrase) => lowerAnswer.includes(phrase));
}
