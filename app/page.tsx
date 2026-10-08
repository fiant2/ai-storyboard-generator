// app/page.tsx
'use client';
import { useState } from 'react';

interface StoryboardPanel {
  panel_number: number;
  visual_description: string;
  camera_angle: string;
  image_prompt: string;
  image_url: string;
  provider: string;
}

export default function Home() {
  const [naskah, setNaskah] = useState<string>('');
  const [characterRef, setCharacterRef] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<StoryboardPanel[] | null>(null);
  const [error, setError] = useState<string>('');
  const [panelLoading, setPanelLoading] = useState<Record<number, boolean>>({});

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setPanelLoading({});

    try {
      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naskah, character_ref: characterRef }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details ? `${data.error}: ${data.details}` : data.error || 'Terjadi kesalahan pada server');
      }
      
      setResult(data.data);
      
      const initialLoading: Record<number, boolean> = {};
      data.data.forEach((panel: StoryboardPanel) => {
        initialLoading[panel.panel_number] = true;
      });
      setPanelLoading(initialLoading);
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleImageLoad = (panelNumber: number) => {
    setPanelLoading(prev => ({ ...prev, [panelNumber]: false }));
  };

  const handleImageError = (panelNumber: number, imageUrl: string) => {
    console.warn(`️ Panel ${panelNumber} gagal, retry...`);
    const retryUrl = imageUrl.includes('?') ? `${imageUrl}&retry=${Date.now()}` : `${imageUrl}?retry=${Date.now()}`;
    const img = document.querySelector(`img[data-panel="${panelNumber}"]`) as HTMLImageElement;
    if (img) img.src = retryUrl;
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold text-indigo-700 tracking-tight">AI Storyboard Generator</h1>
          <p className="text-gray-500">Ubah naskah cerita Anda menjadi visual storyboard dalam hitungan detik.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Naskah Cerita</label>
            <textarea
              className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
              rows={4}
              placeholder="Contoh: Seorang detektif masuk ke ruangan gelap. Dia menyalakan senter dan menemukan peta. Tiba-tiba bayangan bergerak..."
              value={naskah}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNaskah(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Referensi Karakter (Opsional)</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition"
              placeholder="Contoh: Detektif pria, jas hujan kuning, topi fedora"
              value={characterRef}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCharacterRef(e.target.value)}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !naskah.trim()}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {loading ? 'Sedang Membuat Storyboard...' : 'Generate Storyboard'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 border-b border-gray-200 pb-3">Hasil Storyboard ({result.length} Panel)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.map((panel: StoryboardPanel) => (
                <div key={panel.panel_number} className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <div className="relative aspect-video bg-gray-100">
                    {panelLoading[panel.panel_number] && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 z-10 bg-gray-100">
                        <svg className="animate-spin h-8 w-8 text-indigo-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm font-medium">Memuat gambar...</span>
                      </div>
                    )}
                    
                    <img 
                      src={panel.image_url} 
                      alt={`Panel ${panel.panel_number}`}
                      data-panel={panel.panel_number}
                      className={`w-full h-full object-cover transition-opacity duration-500 ${panelLoading[panel.panel_number] ? 'opacity-0' : 'opacity-100'}`}
                      onLoad={() => handleImageLoad(panel.panel_number)}
                      onError={() => handleImageError(panel.panel_number, panel.image_url)}
                    />
                  </div>
                  
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <span className="font-bold text-indigo-600 text-lg">Panel {panel.panel_number}</span>
                      <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-1 rounded-md uppercase tracking-wide">
                        {panel.camera_angle}
                      </span>
                    </div>
                    <p className="text-gray-700 leading-relaxed">&quot;{panel.visual_description}&quot;</p>
                    <details className="group">
                      <summary className="cursor-pointer text-sm text-indigo-500 font-medium hover:text-indigo-700 flex items-center gap-1">
                        <span>Lihat Prompt Gambar</span>
                        <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </summary>
                      <p className="mt-2 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200 font-mono">{panel.image_prompt}</p>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}