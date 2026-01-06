"use client";

import { useEffect, useRef, useState } from "react";

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
  createdAt: number;
};

/* ================= COMPONENT ================= */

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /* ================= RESTORE + MIGRATE ================= */

  useEffect(() => {
    const savedChats = localStorage.getItem("chats");
    const savedActiveChatId = localStorage.getItem("activeChatId");

    if (savedChats) {
      const parsed = JSON.parse(savedChats);

      const migrated: ChatSession[] = parsed.map((chat: any) => ({
        id: chat.id,
        title: chat.title || "New chat",
        messages: Array.isArray(chat.messages) ? chat.messages : [],
        documents: Array.isArray(chat.documents) ? chat.documents : [],
        createdAt: chat.createdAt || Date.now(),
      }));

      setChats(migrated);
    }

    if (savedActiveChatId) setActiveChatId(savedActiveChatId);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("chats", JSON.stringify(chats));
    if (activeChatId) {
      localStorage.setItem("activeChatId", activeChatId);
    }
  }, [chats, activeChatId, hydrated]);

  /* ================= HELPERS ================= */

  const activeChat = chats.find((c) => c.id === activeChatId);
  const messages = activeChat?.messages ?? [];

  const allUploadedDocuments = Array.from(
    new Map(
      chats.flatMap((c) => c.documents).map((d) => [d.docId, d])
    ).values()
  );

  function createNewChatAndActivate(): string {
    const id = crypto.randomUUID();
    const newChat: ChatSession = {
      id,
      title: "New chat",
      messages: [],
      documents: [],
      createdAt: Date.now(),
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);
    return id;
  }

  function updateActiveChat(
    updater: (chat: ChatSession) => ChatSession
  ) {
    if (!activeChatId) return;
    setChats((prev) =>
      prev.map((c) => (c.id === activeChatId ? updater(c) : c))
    );
  }

  /* ================= UPLOAD ================= */

  async function handleUpload() {
    if (!file || uploading) return;

    const chatId = activeChatId ?? createNewChatAndActivate();

    setUploading(true);
    setUploadMessage(null);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok && res.status !== 409) {
        throw new Error(data.error || "Upload failed");
      }

      setChats((prev) =>
        prev.map((chat) =>
          chat.id === chatId
            ? {
                ...chat,
                documents: chat.documents.some(
                  (d) => d.docId === data.doc_id
                )
                  ? chat.documents
                  : [
                      ...chat.documents,
                      { docId: data.doc_id, fileName: file.name },
                    ],
              }
            : chat
        )
      );

      res.status === 409
        ? setUploadError(`Document "${file.name}" already exists.`)
        : setUploadMessage(`Document "${file.name}" uploaded successfully.`);

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  /* ================= ASK ================= */

  async function handleAsk() {
    if (!question.trim() || asking || !activeChat) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: question,
    };

    updateActiveChat((chat) => ({
      ...chat,
      title:
        chat.messages.length === 0
          ? question.slice(0, 40)
          : chat.title,
      messages: [...chat.messages, userMessage],
    }));

    const isVagueDocQuery =
      /describe|summarize|explain/i.test(question) &&
      /pdf|document|file|paper/i.test(question);

    const mentionedDoc = allUploadedDocuments.find((d) =>
      question.toLowerCase().includes(d.fileName.toLowerCase())
    );

    setQuestion("");

    if (
      activeChat.documents.length === 0 &&
      isVagueDocQuery &&
      !mentionedDoc
    ) {
      const previous =
        allUploadedDocuments.length > 0
          ? "\n\nPreviously uploaded documents:\n" +
            allUploadedDocuments.map((d) => `• ${d.fileName}`).join("\n")
          : "";

      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            role: "assistant",
            content:
              "No documents are uploaded in this chat." + previous,
          },
        ],
      }));
      return;
    }

    if (activeChat.documents.length > 1 && isVagueDocQuery) {
      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          {
            role: "assistant",
            content:
              "Multiple documents detected. Please specify:\n\n" +
              activeChat.documents
                .map((d) => `• ${d.fileName}`)
                .join("\n"),
          },
        ],
      }));
      return;
    }

    setAsking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mentionedDoc
            ? {
                query: userMessage.content,
                scope: "current_file",
                doc_id: mentionedDoc.docId,
              }
            : activeChat.documents.length > 0
            ? {
                query: userMessage.content,
                scope: "current_file",
                doc_id: activeChat.documents[0].docId,
              }
            : {
                query: userMessage.content,
                scope: "all_files",
              }
        ),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          { role: "assistant", content: data.answer },
        ],
      }));
    } catch (err: any) {
      updateActiveChat((chat) => ({
        ...chat,
        messages: [
          ...chat.messages,
          { role: "assistant", content: err.message },
        ],
      }));
    } finally {
      setAsking(false);
    }
  }

  /* ================= UI ================= */

  return (
    <main className="min-h-screen flex bg-[#0f0f0f] text-white">
      <aside className="w-64 border-r border-gray-800 bg-[#111] p-4">
        <button
          onClick={createNewChatAndActivate}
          className="w-full mb-4 px-3 py-2 bg-white text-black rounded"
        >
          + New Chat
        </button>

        {/* ✅ ADDED: Link to Documents page */}
        <a
          href="/documents"
          className="block w-full mb-4 px-3 py-2 text-center bg-[#1f1f1f] rounded hover:bg-[#2a2a2a]"
        >
          View Uploaded Documents
        </a>

        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => setActiveChatId(chat.id)}
            className={`w-full text-left px-3 py-2 rounded ${
              chat.id === activeChatId
                ? "bg-[#1f1f1f]"
                : "hover:bg-[#1a1a1a]"
            }`}
          >
            {chat.title}
          </button>
        ))}
      </aside>

      <section className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-6 py-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`p-4 rounded ${
                  msg.role === "user"
                    ? "bg-[#1f1f1f]"
                    : "bg-[#161616]"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-800 bg-[#111] p-4">
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={(e) =>
                  setFile(e.target.files?.[0] || null)
                }
              />
              <button onClick={handleUpload} disabled={uploading}>
                Upload
              </button>
            </div>

            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAsk()}
              placeholder="Ask anything…"
            />
          </div>
        </div>
      </section>
    </main>
  );
}
