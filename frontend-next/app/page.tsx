"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-3xl bg-white p-10 rounded shadow text-center">
        <h1 className="text-3xl font-bold text-black mb-4">
          Neural Search Engine
        </h1>

        <p className="text-gray-700 text-lg mb-6 leading-relaxed">
          Neural Search Engine is an AI-powered document intelligence system that
          allows you to upload documents and ask natural language questions.
          The system uses vector embeddings, semantic search, and large language
          models to retrieve accurate, source-backed answers from your files.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-sm text-gray-700">
          <div className="border rounded p-4">
            📄 Upload PDFs or text documents
          </div>
          <div className="border rounded p-4">
            🔍 Semantic search with vector databases
          </div>
          <div className="border rounded p-4">
            🤖 AI-generated answers with sources
          </div>
        </div>

        <button
          onClick={() => router.push("/upload")}
          className="px-6 py-3 bg-black text-white rounded hover:bg-gray-800 transition"
        >
          Get Started
        </button>
      </div>
    </main>
  );
}
