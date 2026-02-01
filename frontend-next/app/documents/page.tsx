"use client";

import { useEffect, useState } from "react";
import { FileText, Download, Search, Loader2 } from "lucide-react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";

type DocumentItem = {
  docId: string;
  fileName: string;
};

type ChatSession = {
  documents: DocumentItem[];
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch documents from backend metadata API instead of localStorage
    // This ensures consistency with the metadata query results
    const fetchDocuments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'list all documents' })
        });

        const data = await response.json();

        if (data.intent === 'metadata' && data.documents) {
          // Map backend response to frontend format
          const mappedDocs = data.documents.map((doc: any) => ({
            docId: doc.doc_id,
            fileName: doc.source_file || doc.doc_id
          }));
          setDocuments(mappedDocs);
        } else {
          setDocuments([]);
        }
      } catch (error) {
        console.error('Failed to fetch documents:', error);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  function downloadDocument(doc: DocumentItem) {
    window.location.href = `http://localhost:5000/api/upload/documents/${doc.docId}/download`;
  }

  const filteredDocuments = documents.filter((doc) =>
    doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
          <p className="text-lg text-slate-400">Loading your documents...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header Section */}
        <div className="mb-12 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg shadow-blue-500/20">
                <FileText className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Document Library
              </h1>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
              title="Refresh List"
            >
              <Loader2 className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-400 text-lg ml-16">
            Manage and access all your uploaded documents
          </p>
        </div>

        {/* Search Bar */}
        {documents.length > 0 && (
          <div className="mb-8 relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-500 transition-colors group-hover:text-blue-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl pl-12 pr-4 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300"
            />
          </div>
        )}

        {/* Documents Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="p-6 bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 mb-6">
              <FileText className="w-16 h-16 text-slate-600" />
            </div>
            <h2 className="text-2xl font-semibold text-slate-300 mb-2">
              {searchQuery ? "No documents found" : "No documents uploaded"}
            </h2>
            <p className="text-slate-500">
              {searchQuery
                ? "Try adjusting your search query"
                : "Upload documents to get started"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc, index) => (
              <div
                key={doc.docId}
                className="group relative bg-gradient-to-br from-slate-900/80 to-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1"
                style={{
                  animation: `slideUp 0.4s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 rounded-xl transition-all duration-300" />

                <div className="relative flex items-start gap-4">
                  <div className="p-3 bg-slate-800 rounded-lg group-hover:bg-gradient-to-br group-hover:from-blue-500 group-hover:to-purple-600 transition-all duration-300">
                    <FileText className="w-6 h-6 text-slate-400 group-hover:text-white transition-colors" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium mb-1 truncate group-hover:text-blue-300 transition-colors">
                      {doc.fileName}
                    </h3>
                    <p className="text-xs text-slate-500">Document ID: {doc.docId.slice(0, 8)}...</p>
                  </div>
                </div>

                <button
                  onClick={() => downloadDocument(doc)}
                  className="relative mt-6 w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 text-white px-4 py-3 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 group/btn overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/20 to-blue-400/0 translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-700" />
                  <Download className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                  <span>Download</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
      `}</style>
    </main>
  );
}