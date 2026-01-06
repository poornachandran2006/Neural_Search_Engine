"use client";

import { useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [currentDocId, setCurrentDocId] = useState<string | null>(null);

  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------- Upload ----------------
  async function handleUpload() {
    if (!file || uploading) return;

    setUploading(true);
    setUploadMessage(null);
    setUploadError(null);

    const fileName = file.name; // ✅ frontend-trusted filename

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      // 🔴 DUPLICATE FILE
      if (res.status === 409) {
        setUploadError(`Document "${fileName}" is already uploaded.`);
        setCurrentDocId(data.doc_id); // still allow querying
        return;
      }

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      // 🟢 NEW FILE
      setCurrentDocId(data.doc_id);
      setUploadMessage(`Document "${fileName}" uploaded.`);

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---------------- Ask ----------------
  async function handleAsk() {
    if (!question.trim() || asking) return;

    setAsking(true);

    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    setChat((prev) => [...prev, userMessage]);
    setQuestion("");

    try {
      const body: any = {
        query: userMessage.content,
      };

      // 🎯 Scope handling
      if (currentDocId) {
        body.scope = "current_file";
        body.current_doc_id = currentDocId;
      } else {
        body.scope = "all_files";
      }

      const res = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Query failed");
      }

      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No answer found.",
        },
      ]);
    } catch (err: any) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err.message || "Failed to get answer.",
        },
      ]);
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-[#0f0f0f] text-white">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {chat.length === 0 && (
            <p className="text-gray-400 text-center">
              Upload a document and ask questions about it.
            </p>
          )}

          {chat.map((msg, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg ${
                msg.role === "user"
                  ? "bg-[#1f1f1f]"
                  : "bg-[#161616] text-gray-200"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {asking && (
            <div className="text-gray-400 text-sm">AI is thinking…</div>
          )}
        </div>
      </div>

      {/* Input Bar */}
      <div className="border-t border-gray-800 bg-[#111] px-4 py-4">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {/* Upload */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              disabled={uploading}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-300"
            />

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`px-4 py-2 rounded text-sm ${
                uploading
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-white text-black hover:bg-gray-200"
              }`}
            >
              {uploading ? "Uploading…" : "Upload"}
            </button>
          </div>

          {uploadMessage && (
            <p className="text-sm text-green-400">{uploadMessage}</p>
          )}
          {uploadError && (
            <p className="text-sm text-red-400">{uploadError}</p>
          )}

          {/* Ask */}
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            disabled={asking}
            placeholder={
              currentDocId
                ? "Ask anything about your document…"
                : "Ask questions from previously uploaded documents…"
            }
            className="w-full bg-[#1a1a1a] border border-gray-700 rounded px-4 py-3 text-sm text-white"
          />
        </div>
      </div>
    </main>
  );
}
