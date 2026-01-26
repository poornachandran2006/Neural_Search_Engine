"use client";

import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-purple-500/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse delay-700"></div>
      </div>

      <div className="w-full max-w-4xl mx-4 relative z-10">
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-xl p-12 rounded-2xl shadow-2xl border border-gray-700/50 transform transition-all duration-500 hover:shadow-blue-500/20">
          
          {/* Header with gradient text */}
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4 animate-fade-in">
              Neural Search Engine
            </h1>
            <div className="h-1 w-24 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
          </div>

          <p className="text-gray-300 text-lg mb-10 leading-relaxed text-center max-w-2xl mx-auto">
            An AI-powered document intelligence system that allows you to upload documents and ask natural language questions.
            The system uses vector embeddings, semantic search, and large language models to retrieve accurate, source-backed answers from your files.
          </p>

          {/* Feature cards with hover effects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
            <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-6 transition-all duration-300 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/20 hover:-translate-y-1 cursor-pointer">
              <div className="text-4xl mb-3 transition-transform duration-300 group-hover:scale-110">📄</div>
              <p className="text-gray-300 font-medium">Upload PDFs or text documents</p>
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-blue-500/0 group-hover:from-blue-500/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
            </div>

            <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-6 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-1 cursor-pointer">
              <div className="text-4xl mb-3 transition-transform duration-300 group-hover:scale-110">🔍</div>
              <p className="text-gray-300 font-medium">Semantic search with vector databases</p>
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
            </div>

            <div className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 border border-gray-700/50 rounded-xl p-6 transition-all duration-300 hover:border-pink-500/50 hover:shadow-lg hover:shadow-pink-500/20 hover:-translate-y-1 cursor-pointer">
              <div className="text-4xl mb-3 transition-transform duration-300 group-hover:scale-110">🤖</div>
              <p className="text-gray-300 font-medium">AI-generated answers with sources</p>
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-pink-500/0 group-hover:from-pink-500/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>
            </div>
          </div>

          {/* CTA Button with modern styling */}
          <div className="text-center">
            <button
              onClick={() => router.push("/upload")}
              className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/50 hover:scale-105 active:scale-95"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                Get Started
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </div>

        </div>

        {/* Subtle tech details at bottom */}
        <div className="mt-6 text-center text-gray-500 text-sm flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Powered by AI
          </span>
          <span>•</span>
          <span>Secure & Private</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out;
        }
        .delay-700 {
          animation-delay: 700ms;
        }
      `}</style>
    </main>
  );
}