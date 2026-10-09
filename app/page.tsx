'use client';

import { useState, type FormEvent } from 'react';

interface StoryboardPanel {
  panel_number: number;
  visual_description: string;
  camera_angle: string;
  image_prompt: string;
  image_url: string;
  provider: string;
}

interface GenerateResponse {
  data?: StoryboardPanel[];
  error?: string;
  details?: string;
}

const storyIdeas = [
  {
    label: 'Misteri',
    story: 'Seorang detektif memasuki rumah tua yang sudah lama kosong. Di ruang bawah tanah, ia menemukan foto dirinya saat masih kecil.',
    character: 'Detektif muda, mantel panjang gelap, membawa senter',
  },
  {
    label: 'Petualangan',
    story: 'Seorang penjelajah menemukan peta harta karun di dalam botol. Petunjuknya membawanya menyeberangi hutan dan menuju air terjun tersembunyi.',
    character: 'Penjelajah muda, jaket hijau, ransel usang',
  },
  {
    label: 'Fantasi',
    story: 'Di sebuah desa di atas awan, seorang anak menemukan seekor naga kecil yang kehilangan jalan pulang. Mereka terbang bersama mencari istananya.',
    character: 'Anak pemberani, rambut ikal, jubah ungu',
  },
];

export default function Home() {
  const [naskah, setNaskah] = useState('');
  const [characterRef, setCharacterRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StoryboardPanel[] | null>(null);
  const [error, setError] = useState('');
  const [panelLoading, setPanelLoading] = useState<Record<number, boolean>>({});
  const [panelFailed, setPanelFailed] = useState<Record<number, boolean>>({});
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [retryCounts, setRetryCounts] = useState<Record<number, number>>({});
  const [copiedPanel, setCopiedPanel] = useState<number | null>(null);
  const [storyCopied, setStoryCopied] = useState(false);

  const handleGenerate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!naskah.trim() || loading) return;

    setLoading(true);
    setError('');
    setResult(null);
    setPanelLoading({});
    setPanelFailed({});
    setImageUrls({});
    setRetryCounts({});

    try {
      const response = await fetch('/api/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naskah, character_ref: characterRef }),
      });
      const data: GenerateResponse = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details
            ? `${data.error || 'Gagal membuat storyboard.'} ${data.details}`
            : data.error || 'Terjadi kesalahan pada server.',
        );
      }

      if (!Array.isArray(data.data)) {
        throw new Error('Server tidak mengembalikan hasil storyboard yang valid.');
      }

      setResult(data.data);
      setPanelLoading(
        Object.fromEntries(data.data.map((panel) => [panel.panel_number, true])),
      );
      setImageUrls(
        Object.fromEntries(data.data.map((panel) => [panel.panel_number, panel.image_url])),
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan yang tidak diketahui.');
    } finally {
      setLoading(false);
    }
  };

  const retryImage = (panel: StoryboardPanel) => {
    const currentUrl = imageUrls[panel.panel_number] || panel.image_url;
    const retryUrl = new URL(currentUrl);
    const retryCount = (retryCounts[panel.panel_number] || 0) + 1;
    retryUrl.searchParams.set('retry', retryCount.toString());
    setRetryCounts((current) => ({ ...current, [panel.panel_number]: retryCount }));
    setImageUrls((current) => ({ ...current, [panel.panel_number]: retryUrl.toString() }));
    setPanelFailed((current) => ({ ...current, [panel.panel_number]: false }));
    setPanelLoading((current) => ({ ...current, [panel.panel_number]: true }));
  };

  const copyText = async (text: string, panelNumber?: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setError('');
      if (panelNumber === undefined) {
        setStoryCopied(true);
        window.setTimeout(() => setStoryCopied(false), 1800);
      } else {
        setCopiedPanel(panelNumber);
        window.setTimeout(() => setCopiedPanel(null), 1800);
      }
    } catch {
      setError('Tidak dapat menyalin teks. Pastikan izin clipboard di browser diaktifkan.');
    }
  };

  return (
    <main className="app-shell">
      <nav className="site-nav" aria-label="Navigasi utama">
        <a className="nav-brand" href="#beranda" aria-label="AI Storyboard Generator - Beranda">
          <span className="nav-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 5.5h16v13H4z" />
              <path d="m4.5 17 5-5 3.3 3.1 2.2-2.2 4.5 4.1M8 9h.01" />
            </svg>
          </span>
          <span>Story<span>board</span></span>
        </a>
        <div className="nav-links">
          <a className="nav-link" href="#beranda">Beranda</a>
          <a className="nav-link" href="#tentang">Tentang</a>
          <a className="nav-cta" href="#generator">Buat storyboard <span aria-hidden="true">↗</span></a>
        </div>
      </nav>

      <div className="page-content">
        <section className="home-section" id="beranda">
        <header className="hero">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 5.5h16v13H4z" />
              <path d="m4.5 17 5-5 3.3 3.1 2.2-2.2 4.5 4.1M8 9h.01" />
            </svg>
          </div>
          <p className="eyebrow">CERITA KAMU, VISUALKAN</p>
          <h1>Ide ceritamu, jadi <span>storyboard.</span></h1>
          <p className="hero-copy">
            Ubah naskah cerita menjadi rangkaian adegan visual dengan bantuan AI.
          </p>
          <div className="hero-note">
            <span className="hero-note-sparkle" aria-hidden="true">✦</span>
            Dari imajinasi jadi empat adegan visual
          </div>
        </header>

        <section className="generator-card" id="generator" aria-labelledby="form-heading">
          <div className="creation-steps" aria-label="Langkah pembuatan storyboard">
            <span className={`creation-step ${loading || result ? 'complete' : 'active'}`}>
              <span>{loading || result ? '✓' : '1'}</span>Tulis cerita
            </span>
            <span className={`step-line ${result || loading ? 'complete' : ''}`} />
            <span className={`creation-step ${result ? 'complete' : loading ? 'active' : ''}`}>
              <span>{result ? '✓' : '2'}</span>Rangkai adegan
            </span>
            <span className={`step-line ${result ? 'complete' : ''}`} />
            <span className={`creation-step ${result ? 'active' : ''}`}><span>3</span>Lihat storyboard</span>
          </div>
          <div className="section-heading">
            <div>
              <span className="step-label">MULAI DI SINI</span>
              <h2 id="form-heading">Ceritakan idemu</h2>
              <p>Isi naskah dan karakter utama untuk membuat empat panel storyboard.</p>
            </div>
            <span className="panel-count">
              <span className="count-dot" aria-hidden="true" />
              4 panel
            </span>
          </div>

          <form className="story-form" onSubmit={handleGenerate}>
            <div className="field-group">
              <div className="field-label-row">
                <label htmlFor="story">Naskah cerita</label>
                <span className="character-count">{naskah.length} karakter</span>
              </div>
              <textarea
                id="story"
                name="story"
                rows={4}
                placeholder="Contoh: Seorang detektif masuk ke ruangan gelap. Dia menyalakan senter dan menemukan peta. Tiba-tiba bayangan bergerak..."
                value={naskah}
                onChange={(event) => {
                  setNaskah(event.target.value);
                  if (error) setError('');
                }}
                required
                aria-describedby="story-hint"
              />
              <span className="field-hint" id="story-hint">
                Tuliskan alur cerita yang ingin diubah menjadi adegan visual.
              </span>
            </div>

            <div className="idea-picker" aria-label="Pilih contoh cerita">
              <span className="idea-picker-label">Butuh inspirasi?</span>
              {storyIdeas.map((idea) => (
                <button
                  className="idea-chip"
                  key={idea.label}
                  type="button"
                  onClick={() => {
                    setNaskah(idea.story);
                    setCharacterRef(idea.character);
                    setError('');
                  }}
                >
                  <span aria-hidden="true">✦</span>
                  {idea.label}
                </button>
              ))}
            </div>

            <div className="field-group">
              <label htmlFor="character">Referensi karakter <span>(opsional)</span></label>
              <input
                id="character"
                name="character"
                type="text"
                placeholder="Contoh: Detektif pria, jas hujan kuning, topi fedora"
                value={characterRef}
                onChange={(event) => setCharacterRef(event.target.value)}
              />
              <span className="field-hint">
                Deskripsikan penampilan karakter agar konsisten di setiap panel.
              </span>
            </div>

            <button className="generate-button" type="submit" disabled={loading || !naskah.trim()}>
              {loading ? (
                <>
                  <span className="button-spinner" aria-hidden="true" />
                  Sedang menyusun storyboard...
                </>
              ) : (
                <>
                  Generate Storyboard
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M5 12h14m-6-6 6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </section>

        {error && (
          <div className="error-message" role="alert">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 8v5m0 3h.01M10.3 4.7 2.8 18a1.5 1.5 0 0 0 1.3 2.2h15.8a1.5 1.5 0 0 0 1.3-2.2L13.7 4.7a2 2 0 0 0-3.4 0Z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="generation-status" role="status" aria-live="polite">
            <span className="status-spinner" aria-hidden="true" />
            <div>
              <strong>AI sedang merangkai ceritamu</strong>
              <span>Menyiapkan adegan dan ilustrasi. Ini mungkin perlu beberapa saat.</span>
            </div>
          </div>
        )}

        {result && (
          <section className="results-section" aria-labelledby="results-heading">
            <div className="results-heading">
              <div>
                <span className="step-label">HASIL GENERASI</span>
                <h2 id="results-heading">Storyboard kamu</h2>
              </div>
                <div className="results-actions">
                  <span className="results-total">{result.length} adegan</span>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => copyText(naskah)}
                  >
                    {storyCopied ? 'Naskah tersalin!' : 'Salin naskah'}
                  </button>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => {
                      document.getElementById('form-heading')?.scrollIntoView({ behavior: 'smooth' });
                      document.getElementById('story')?.focus({ preventScroll: true });
                    }}
                  >
                    Ubah cerita
                  </button>
                  <button
                    className="text-action text-action-primary"
                    type="button"
                    onClick={() => document.querySelector<HTMLFormElement>('.story-form')?.requestSubmit()}
                  >
                    Buat ulang
                  </button>
                </div>
              </div>

            <div className="panel-grid">
              {result.map((panel) => (
                <article className="panel-card" key={panel.panel_number}>
                  <div className="panel-image">
                    {panelLoading[panel.panel_number] && !panelFailed[panel.panel_number] && (
                      <div className="image-placeholder" role="status">
                        <span className="status-spinner" aria-hidden="true" />
                        <span>Menyiapkan ilustrasi...</span>
                      </div>
                    )}
                    {panelFailed[panel.panel_number] ? (
                      <div className="image-failed">
                        <span className="failed-icon" aria-hidden="true">!</span>
                        <strong>Ilustrasi belum bisa dimuat</strong>
                        <button type="button" onClick={() => retryImage(panel)}>
                          Coba muat ulang
                        </button>
                      </div>
                    ) : (
                      <img
                        src={imageUrls[panel.panel_number] || panel.image_url}
                        alt={`Ilustrasi panel ${panel.panel_number}: ${panel.visual_description}`}
                        className={panelLoading[panel.panel_number] ? 'panel-image-loading' : ''}
                        onLoad={() =>
                          setPanelLoading((current) => ({
                            ...current,
                            [panel.panel_number]: false,
                          }))
                        }
                        onError={() => {
                          setPanelLoading((current) => ({
                            ...current,
                            [panel.panel_number]: false,
                          }));
                          setPanelFailed((current) => ({
                            ...current,
                            [panel.panel_number]: true,
                          }));
                        }}
                      />
                    )}
                    <span className="image-number">
                      {String(panel.panel_number).padStart(2, '0')}
                    </span>
                    {!panelLoading[panel.panel_number] && !panelFailed[panel.panel_number] && (
                      <a
                        className="image-open"
                        href={imageUrls[panel.panel_number] || panel.image_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Buka ilustrasi panel ${panel.panel_number} di tab baru`}
                      >
                        Buka ilustrasi
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M11 3h6v6m0-6-8 8M15 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <div className="panel-details">
                    <div className="panel-meta">
                      <span className="panel-label">ADEGAN {String(panel.panel_number).padStart(2, '0')}</span>
                      <span className="camera-tag">{panel.camera_angle}</span>
                    </div>
                    <p className="panel-description">{panel.visual_description}</p>
                    <details className="prompt-details">
                      <summary>
                        Lihat prompt gambar
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="m5 7.5 5 5 5-5" />
                        </svg>
                      </summary>
                      <p>{panel.image_prompt}</p>
                      <button
                        className="copy-prompt"
                        type="button"
                        onClick={() => copyText(panel.image_prompt, panel.panel_number)}
                      >
                        {copiedPanel === panel.panel_number ? 'Prompt tersalin!' : 'Salin prompt'}
                      </button>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        </section>

        <section className="about-section" id="tentang" aria-labelledby="about-heading">
          <div className="about-intro">
            <span className="step-label">TENTANG PLATFORM</span>
            <h2 id="about-heading">Dari ide sederhana menjadi cerita visual.</h2>
            <p>
              AI Storyboard Generator membantu kamu memvisualisasikan naskah cerita.
              Cukup tulis ide, tentukan karakter, lalu biarkan AI menyusun empat adegan
              yang bisa menjadi titik awal karya kreatifmu.
            </p>
          </div>

          <div className="about-features">
            <article className="about-feature">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 4.5h14v15H5zM8 8h8m-8 4h5m-5 4h7" />
                </svg>
              </span>
              <h3>Mulai dari naskahmu</h3>
              <p>Masukkan cerita singkat dan referensi karakter agar visual lebih sesuai idemu.</p>
            </article>
            <article className="about-feature">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 5h7v6H4zm9 0h7v6h-7zM4 13h7v6H4zm9 0h7v6h-7z" />
                </svg>
              </span>
              <h3>Empat adegan terstruktur</h3>
              <p>AI merangkum cerita menjadi empat panel lengkap dengan deskripsi dan sudut kamera.</p>
            </article>
            <article className="about-feature">
              <span className="feature-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.64 5.64l2.12 2.12m8.48 8.48 2.12 2.12m0-12.72-2.12 2.12m-8.48 8.48-2.12 2.12M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                </svg>
              </span>
              <h3>Visual untuk inspirasi</h3>
              <p>Lihat ilustrasi tiap adegan dan gunakan hasilnya sebagai awal proses kreatif.</p>
            </article>
          </div>

          <div className="about-cta">
            <div>
              <strong>Punya cerita di kepala?</strong>
              <span>Mulai ubah jadi storyboard sekarang.</span>
            </div>
            <a href="#generator">
              Mulai membuat
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </a>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        <span>© 2026 AI Storyboard Generator</span>
        <a href="#beranda">Kembali ke atas ↑</a>
      </footer>
    </main>
  );
}
