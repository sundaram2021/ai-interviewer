'use client';

import { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface ProfileModalProps {
  onComplete: (userId: string) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function ProfileModal({ onComplete }: ProfileModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !githubUrl) {
      setError('Please provide both a resume and a GitHub profile URL.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('githubUrl', githubUrl);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process profile');

      onComplete(data.userId);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'An error occurred during profiling.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-xl font-medium text-zinc-100 mb-2">
          Create Candidate Profile
        </h2>
        <p className="text-sm text-zinc-400 mb-6">
          Set up your interviewer memory by uploading your resume and adding
          your GitHub link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Resume (PDF or Text)
            </label>
            <label className="flex flex-col items-center justify-center border border-dashed border-zinc-700 rounded-xl p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors">
              <Upload className="w-5 h-5 text-zinc-400 mb-1" />
              <span className="text-sm text-zinc-300">
                {file ? file.name : 'Select or drag file'}
              </span>
              <input
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              GitHub URL
            </label>
            <div className="relative">
              <svg
                className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
              </svg>
              <input
                type="url"
                required
                placeholder="https://github.com/username"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-amber-500 font-medium">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-medium py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing Profile...
              </>
            ) : (
              'Initialize Memory'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
