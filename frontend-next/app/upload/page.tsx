"use client";

import { useEffect, useRef, useState } from "react";
import { useSupressHydrationWarning } from "../hooks/useSupressHydrationWarning";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

/* ================= TYPES ================= */

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatDocument = {
  docId: string;
  fileName: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  documents: ChatDocument[];
  currentDocId: string | null;
  createdAt: number;
};

/* ================= NORMALIZATION ================= */

function normalizeQuery(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function isAmbiguousQuery(input: string): boolean {
  const q = input.toLowerCase();

  // ONLY block when the user EXPLICITLY refers to a specific document
  const explicitDocumentReferences = [
    "this document",
    "this file",
    "current document",
    "this pdf",
    "this doc",
    "summarize this",
    "summarise this",
  ];

  return explicitDocumentReferences.some((phrase) => q.includes(phrase));
}


/* ================= COMPONENT ================= */

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [queryMode, setQueryMode] = useState<"current" | "all">("current");
  const [docDropdownOpen, setDocDropdownOpen] = useState(false);
  const [docSearch, setDocSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Suppress browser extension hydration warnings
  useSupressHydrationWarning();

  /* ================= RESTORE ================= */

  useEffect(() => {
    const savedChats = localStorage.getItem("chats");
    const savedActiveChatId = localStorage.getItem("activeChatId");

    if (savedChats) {
      const parsed: ChatSession[] = JSON.parse(savedChats);

      const fixed = parsed.map((chat) => {
        if (chat.documents.length > 0 && !chat.currentDocId) {
          return {
            ...chat,
            currentDocId: chat.documents[chat.documents.length - 1].docId,
          };
        }
        return chat;
      });

      setChats(fixed);
    }

    if (savedActiveChatId) {
      setActiveChatId(savedActiveChatId);
    } else if (savedChats) {
      // Auto-select the last chat if exists to prevent disabled UI
      const parsedIds: ChatSession[] = JSON.parse(savedChats);
      if (parsedIds.length > 0) {
        setActiveChatId(parsedIds[0].id);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("chats", JSON.stringify(chats));
    if (activeChatId) localStorage.setItem("activeChatId", activeChatId);
  }, [chats, activeChatId, hydrated]);

  /* ================= HELPERS ================= */

  const activeChat = chats.find((c) => c.id === activeChatId);
  const messages = activeChat?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Merge chat-based docs with server-based docs to ensure we see EVERYTHING
  // Server docs take precedence for existence, but we use chat docs for local state coherence if needed.
  // Actually, simplest is to use a map to deduplicate by docId.
  const [serverDocuments, setServerDocuments] = useState<ChatDocument[]>([]);

  const allUploadedDocuments: ChatDocument[] = Array.from(
    new Map([
      ...serverDocuments.map((doc) => [doc.docId, doc] as const),
      ...chats.flatMap((chat) => chat.documents).map((doc) => [doc.docId, doc] as const)
    ]).values()
  );

  // Sync with backend on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/documents`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.documents)) {
          setServerDocuments(data.documents);
        }
      })
      .catch(err => console.error("Failed to fetch documents:", err));
  }, []);

  function createNewChatAndActivate(): string {
    const id = crypto.randomUUID();
    setChats((prev) => [
      {
        id,
        title: "New chat",
        messages: [],
        documents: [],
        currentDocId: null,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
    setActiveChatId(id);
    //setQueryMode("current");
    return id;
  }

  function updateActiveChat(updater: (chat: ChatSession) => ChatSession) {
    if (!activeChatId) return;
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? updater(c) : c)),
    );
  }

  function selectCurrentDocument(doc: ChatDocument, specificChatId?: string) {
    const targetId = specificChatId || activeChatId;
    if (!targetId) return;

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === targetId
          ? {
            ...chat,
            currentDocId: doc.docId,
          }
          : chat,
      ),
    );

    if (specificChatId) {
      setActiveChatId(specificChatId);
    }
    setQueryMode("current");
    setDocDropdownOpen(false);
  }

  /* ================= RESET ================= */

  function handleResetEverything() {
    localStorage.removeItem("chats");
    localStorage.removeItem("activeChatId");
    setChats([]);
    setActiveChatId(null);
    setQuestion("");
    setFile(null);
    setQueryMode("current");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /* ================= UPLOAD ================= */

  async function handleUpload() {
    if (!file || uploading) return;

    const chatId = activeChatId ?? createNewChatAndActivate();

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Client-side file type validation
      const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx', '.md'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

      if (!allowedExtensions.includes(fileExtension)) {
        throw new Error("Unsupported file format.");
      }

      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      // Handle 409 Duplicate specifically (treated as error per requirements)
      if (res.status === 409 || data.status === "duplicate") {
        throw new Error("The file already exists.");
      }

      // Validate response has explicit success status
      if (!res.ok) {
        throw new Error(data.error || data.message || "Upload failed");
      }

      // Only accept 'uploaded' as valid success states
      if (data.status !== "uploaded") {
        throw new Error(data.error || "Unsupported file format.");
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
              ...chat,
              documents: chat.documents.some((d) => d.docId === data.doc_id)
                ? chat.documents
                : [
                  ...chat.documents,
                  { docId: data.doc_id, fileName: file.name },
                ],
              currentDocId: data.doc_id,
            }
            : chat,
        ),
      );

      setQueryMode("current");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setUploadSuccess("File uploaded successfully.");

    } catch (err: any) {
      setUploadError(err.message);
      // Clear file input on error so filename doesn't persist
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  /* ================= ASK ================= */

  async function handleAsk() {
    if (!question.trim() || asking || !activeChat) return;

    const normalizedQuery = normalizeQuery(question);

    /* ---------------------------------
       1. Always render USER message first
       --------------------------------- */
    updateActiveChat((chat) => ({
      ...chat,
      title:
        chat.messages.length === 0
          ? normalizedQuery.slice(0, 40)
          : chat.title,
      messages: [...chat.messages, { role: "user", content: normalizedQuery }],
    }));

    setQuestion("");

    /* ---------------------------------
       2. All Documents requires at least one document
       --------------------------------- */
    if (queryMode === "all" && allUploadedDocuments.length === 0) {
      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            role: "assistant",
            content:
              "All Documents mode requires at least one uploaded document. Please upload a file first.",
          },
        ],
      }));
      return;
    }

    setAsking(true);

    try {
      /* ---------------------------------
         4. Current Document mode
         --------------------------------- */
      if (queryMode === "current") {
        const docId = activeChat.currentDocId;

        if (!docId) {
          updateActiveChat((chat) => ({
            ...chat,
            messages: [
              ...chat.messages,
              {
                role: "assistant",
                content:
                  "Current Document mode requires a document. Please upload or select one.",
              },
            ],
          }));
          return;
        }

        const res = await fetch(`${API_BASE_URL}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: normalizedQuery,
            scope: "current_file",
            doc_id: docId,
          }),
        });

        const data = await res.json();

        // Handle metadata query response
        let assistantMessage: string;
        if (data.intent === 'metadata') {
          // Format metadata response
          if (data.count === 0) {
            assistantMessage = "No documents have been uploaded yet.";
          } else {
            const docList = data.documents
              .map((doc: any, idx: number) => `${idx + 1}. ${doc.source_file || doc.doc_id}`)
              .join('\n');
            assistantMessage = `Found ${data.count} document${data.count > 1 ? 's' : ''}:\n\n${docList}`;
          }
        } else {
          // Normal RAG response
          assistantMessage = data.answer;
        }

        updateActiveChat((chat) => ({
          ...chat,
          messages: [
            ...chat.messages,
            { role: "assistant", content: assistantMessage },
          ],
        }));

        return;
      }

      /* ---------------------------------
         5. All Documents mode
         --------------------------------- */
      const res = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalizedQuery,
          scope: "all_files",
        }),
      });

      const data = await res.json();

      // Handle metadata query response
      let assistantMessage: string;
      if (data.intent === 'metadata') {
        // Format metadata response
        if (data.count === 0) {
          assistantMessage = "No documents have been uploaded yet.";
        } else {
          const docList = data.documents
            .map((doc: any, idx: number) => `${idx + 1}. ${doc.source_file || doc.doc_id}`)
            .join('\n');
          assistantMessage = `Found ${data.count} document${data.count > 1 ? 's' : ''}:\n\n${docList}`;
        }
      } else {
        // Normal RAG response
        assistantMessage = data.answer;
      }

      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          { role: "assistant", content: assistantMessage },
        ],
      }));
    } catch (err) {
      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            role: "assistant",
            content:
              "Something went wrong while processing your request. Please try again.",
          },
        ],
      }));
    } finally {
      setAsking(false);
    }
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen flex bg-gradient-to-br from-gray-900 via-black to-gray-900 text-gray-100">
      {/* Sidebar */}
      <aside className="w-72 border-r border-gray-800/50 bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Neural Search
          </h2>

          <button
            onClick={createNewChatAndActivate}
            className="w-full mb-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
          >
            <span className="text-lg">+</span>
            New Chat
          </button>

          <button
            onClick={handleResetEverything}
            className="w-full mb-3 px-4 py-2.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg font-medium transition-all duration-300 hover:bg-red-600/30 hover:border-red-500/50"
          >
            Reset Everything
          </button>

          <a
            href="/documents"
            className="block w-full px-4 py-2.5 text-center bg-gray-800/50 border border-gray-700/50 text-gray-300 rounded-lg font-medium transition-all duration-300 hover:bg-gray-800/80 hover:border-gray-600/50"
          >
            📄 View Documents
          </a>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          <h3 className="text-xs uppercase text-gray-500 font-semibold mb-2 px-2">Conversations</h3>
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChatId(chat.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg font-medium transition-all duration-200 truncate ${chat.id === activeChatId
                ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 text-white shadow-lg"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-gray-200"
                }`}
            >
              {chat.title}
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      <section className="flex-1 flex flex-col relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute w-96 h-96 bg-blue-500/5 rounded-full blur-3xl top-0 right-0"></div>
          <div className="absolute w-96 h-96 bg-purple-500/5 rounded-full blur-3xl bottom-0 left-0"></div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-6 py-10 relative z-10">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center">
                  <div className="text-6xl mb-4 opacity-20">💬</div>
                  <p className="text-gray-500 text-lg">Start a conversation or upload a document</p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`group animate-fade-in p-5 rounded-xl backdrop-blur-sm transition-all duration-300 ${msg.role === "user"
                    ? "bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/20 ml-12"
                    : "bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-gray-700/30 mr-12"
                    }`}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === "user"
                      ? "bg-gradient-to-br from-blue-500 to-purple-500"
                      : "bg-gradient-to-br from-gray-700 to-gray-800"
                      }`}>
                      {msg.role === "user" ? "👤" : "🤖"}
                    </div>
                    <div className="flex-1 text-gray-200 leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
            {asking && (
              <div className="flex items-center gap-2 p-5 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/30 border border-gray-700/30 mr-12">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                  🤖
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800/50 bg-gradient-to-b from-gray-900/95 to-black/95 backdrop-blur-xl p-6 relative z-10">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Mode Selection */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-4 text-sm">
                <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-all duration-200 ${queryMode === "current" ? "bg-blue-600/20 border-blue-500/50 text-white" : "bg-gray-800/60 border-gray-700/50 text-gray-400 hover:bg-gray-800"}`}>
                  <input
                    type="radio"
                    checked={queryMode === "current"}
                    onChange={() => setQueryMode("current")}
                    className="accent-blue-500"
                  />
                  <span>Current Document</span>
                </label>

                <label className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-all duration-200 ${queryMode === "all" ? "bg-purple-600/20 border-purple-500/50 text-white" : "bg-gray-800/60 border-gray-700/50 text-gray-400 hover:bg-gray-800"}`}>
                  <input
                    type="radio"
                    checked={queryMode === "all"}
                    onChange={() => {
                      setQueryMode("all");
                      setDocDropdownOpen(false);
                    }}
                    className="accent-purple-500"
                  />
                  <span>All Documents</span>
                </label>
              </div>

              <div className="relative">
                <button
                  disabled={queryMode === "all"}
                  onClick={() => {
                    if (queryMode === "all") return;
                    setDocDropdownOpen((v) => !v);
                  }}
                  className="w-full px-4 py-3 bg-gray-800/60 border border-gray-700/50 rounded-lg text-gray-300 hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-lg">📄</span>
                    <span className="truncate">
                      {queryMode === "all"
                        ? "Searching across all documents"
                        : (activeChat?.currentDocId
                          ? allUploadedDocuments.find(
                            (d) => d.docId === activeChat.currentDocId,
                          )?.fileName
                          : "Select a document...")}
                    </span>
                  </div>
                  {queryMode === "current" && (
                    <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">▼</span>
                  )}
                </button>

                {docDropdownOpen && queryMode === "current" && (
                  <div className="absolute top-full mt-2 left-0 w-full bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in z-50">
                    <input
                      type="text"
                      placeholder="🔍 Search documents..."
                      value={docSearch}
                      onChange={(e) => setDocSearch(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800/80 text-white border-b border-gray-700 outline-none focus:bg-gray-800 transition-colors"
                      autoFocus
                    />

                    <ul className="max-h-64 overflow-y-auto">
                      {allUploadedDocuments.length === 0 && (
                        <li className="px-4 py-4 text-center text-gray-500 text-sm">No documents uploaded yet</li>
                      )}
                      {allUploadedDocuments
                        .filter((doc) =>
                          doc.fileName
                            .toLowerCase()
                            .includes(docSearch.toLowerCase()),
                        )
                        .map((doc) => (
                          <li
                            key={doc.docId}
                            onClick={() => {
                              // Ensure active chat exists before selecting
                              if (!activeChatId) {
                                const newId = createNewChatAndActivate();
                                // We need to wait for state update or pass newId. 
                                // But helper functions rely on state. 
                                // Simplified: Just update `activeChatId` state is enough for next render, 
                                // but here we need to update the chat object immediately.
                                // Let's modify selectCurrentDocument to handle this.
                                selectCurrentDocument(doc, newId);
                              } else {
                                selectCurrentDocument(doc);
                              }
                            }}
                            className={`px-4 py-3 cursor-pointer transition-colors border-l-2 ${activeChat?.currentDocId === doc.docId
                              ? "bg-blue-600/20 text-blue-300 border-blue-500"
                              : "border-transparent hover:bg-gray-800/60 text-gray-300 hover:border-gray-600"
                              }`}
                          >
                            <div className="truncate text-sm">{doc.fileName}</div>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* File Upload */}
            <div className="flex gap-3">
              <label className="flex-1 px-4 py-3 bg-gray-800/60 border border-gray-700/50 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-gray-600 transition-all duration-200 flex items-center gap-3">
                <span className="text-gray-400">📎</span>
                <span className="text-gray-400 text-sm truncate">
                  {file ? file.name : "Choose file..."}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setUploadError(null);
                    setUploadSuccess(null);
                  }}
                  className="hidden"
                />
              </label>
              <button
                onClick={handleUpload}
                disabled={uploading || !file}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>

            {uploadError && (
              <div className="px-4 py-2 bg-red-600/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {uploadError}
              </div>
            )}

            {uploadSuccess && (
              <div className="px-4 py-2 bg-green-600/20 border border-green-500/30 rounded-lg text-green-400 text-sm">
                {uploadSuccess}
              </div>
            )}

            {/* Question Input */}
            <div className="flex gap-3">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAsk()}
                placeholder="Ask anything about your documents..."
                className="flex-1 px-5 py-4 bg-gray-800/60 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 outline-none focus:border-blue-500/50 focus:bg-gray-800 transition-all duration-200"
              />
              <button
                onClick={handleAsk}
                disabled={
                  asking ||
                  !question.trim() ||
                  (queryMode === "current" && !activeChat?.currentDocId)
                }
                className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none flex items-center gap-2"
              >
                {asking ? "Thinking..." : "Send"}
                {!asking && <span className="text-lg">→</span>}
              </button>
            </div>

            {/* Inline Error for Missing Document in Current Mode */}
            {queryMode === "current" && !activeChat?.currentDocId && (
              <div className="text-red-400 text-xs mt-1 text-center">
                Please select a document before asking a question.
              </div>
            )}

          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out forwards;
        }
      `}</style>
    </main >
  );
}