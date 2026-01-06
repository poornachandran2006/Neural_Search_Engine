"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

type DocumentItem = {
  doc_id: string;
  file_name: string;
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/upload/documents`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch documents");
        return res.json();
      })
      .then((data) => setDocuments(data))
      .catch(() => setError("Unable to load documents"))
      .finally(() => setLoading(false));
  }, []);

  function downloadDocument(doc: DocumentItem) {
    window.location.href = `${API_BASE_URL}/api/upload/documents/${doc.doc_id}/download`;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] text-white p-8">
        <p>Loading documents...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#0f0f0f] text-white p-8">
        <p className="text-red-500">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Uploaded Documents</h1>

      {documents.length === 0 ? (
        <p>No documents uploaded.</p>
      ) : (
        <ul className="space-y-3 max-w-3xl">
          {documents.map((doc) => (
            <li
              key={doc.doc_id}
              className="flex justify-between items-center bg-[#161616] px-4 py-3 rounded"
            >
              <span className="truncate">{doc.file_name}</span>
              <button
                onClick={() => downloadDocument(doc)}
                className="ml-4 px-3 py-1 bg-white text-black rounded"
              >
                Download
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
