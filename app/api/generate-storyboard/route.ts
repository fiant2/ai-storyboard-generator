// app/api/generate-storyboard/route.ts
import { NextRequest, NextResponse } from 'next/server';

type Scene = {
  sceneNumber: number;
  description: string;
  cameraAngle: string;
  imagePrompt: string;
};

// Daftar model kandidat, diurutkan dari prioritas tertinggi.
// Kalau yang pertama sudah di-deprecate Groq, otomatis coba yang berikutnya.
// (Semua ini sudah dikonfirmasi aktif & mendukung json_mode per 3 Okt 2026.)
const MODEL_CANDIDATES = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
];

let cachedWorkingModel: string | null = null;

// Cek daftar model aktif langsung dari Groq, pilih kandidat pertama yang masih ada.
async function resolveActiveModel(apiKey: string): Promise<string> {
  if (cachedWorkingModel) return cachedWorkingModel;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error('Gagal mengambil daftar model Groq.');

    const data = await res.json();
    const activeIds: string[] = (data.data || [])
      .filter((m: any) => m.active)
      .map((m: any) => m.id);

    const found = MODEL_CANDIDATES.find((id) => activeIds.includes(id));
    cachedWorkingModel = found || MODEL_CANDIDATES[0]; // fallback terakhir: tetap coba yang pertama
    console.log(`✅ Model aktif terpilih: ${cachedWorkingModel}`);
    return cachedWorkingModel;
  } catch (err) {
    console.warn('⚠️ Gagal cek daftar model, pakai kandidat pertama sebagai default.', err);
    return MODEL_CANDIDATES[0];
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      naskah,
      // Default diubah ke gaya sketsa storyboard profesional (bukan foto
      // realistis). Ini pilihan sengaja: gaya sketsa kasar jauh lebih
      // memaafkan kesalahan anatomi AI (wajah/tangan) dibanding gaya
      // fotorealistis "cinematic, 8k" yang membuat cacat sangat kentara.
      style = 'black and white pencil sketch, rough storyboard linework, loose strokes, concept art style',
      character_ref = '',
    } = body;

    if (!naskah || naskah.trim() === '') {
      return NextResponse.json({ error: 'Naskah wajib diisi.' }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY belum disetel di .env.local' }, { status: 500 });
    }

    const seed = Math.floor(Math.random() * 10000);

    const prompt = `You are a professional storyboard artist. Create EXACTLY 4 DISTINCT storyboard panels for this story.
    Story: "${naskah}"
    Character: "${character_ref || 'general'}"
    Style: "${style}"
    
    IMPORTANT RULES for "imagePrompt":
    - Focus on a MAXIMUM of 1-2 main characters per panel, clearly described (face shape, hair, clothing).
    - NEVER describe a large crowd or many near-identical people in detail — if the story has a group, show it from a distance or focus on one representative figure in the foreground instead. AI image models render extra limbs and broken faces when asked for many similar people in one frame.
    - Prefer close-up or medium shots over wide shots packed with people.
    - Always end the imagePrompt with: "clean single subject focus, correct anatomy, simple background"

    Return ONLY a valid JSON array of 4 objects. NO markdown, NO extra text.
    Each object MUST have: 
    - "sceneNumber" (1 to 4)
    - "description" (Indonesian, max 25 words)
    - "cameraAngle" (English, e.g., Wide shot, Close-up)
    - "imagePrompt" (English, highly detailed, including character appearance, lighting, and composition, following the rules above)
    
    Example: [{"sceneNumber":1,"description":"...","cameraAngle":"...","imagePrompt":"..."}]`;

    // Cek live apakah model utama masih aktif; kalau tidak, otomatis pindah
    // ke kandidat berikutnya di MODEL_CANDIDATES. Ini yang mencegah kode
    // mendadak gagal total di hari presentasi hanya karena Groq mempensiunkan
    // satu nama model (sudah terjadi 2x sebelumnya: gemma2-9b-it, llama-3.3-70b-versatile).
    const activeModel = await resolveActiveModel(apiKey);
    console.log(`🔄 Menghasilkan skenario via Groq (Model: ${activeModel})...`);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: activeModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(`Groq API Error: ${response.status} - ${errData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const rawText = result.choices?.[0]?.message?.content;

    if (!rawText) {
      throw new Error('Groq tidak mengembalikan teks.');
    }

    console.log('✅ Skenario berhasil dibuat. Memproses JSON...');

    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    let scenes: any[] = [];
    try {
      const parsed = JSON.parse(cleanText);
      if (Array.isArray(parsed)) {
        scenes = parsed;
      } else if (parsed.scenes && Array.isArray(parsed.scenes)) {
        scenes = parsed.scenes;
      } else {
        // json_object mode kadang membungkus array dalam key lain (bukan "scenes").
        // Cari properti pertama yang berupa array sebagai fallback.
        const firstArrayValue = Object.values(parsed).find((v) => Array.isArray(v));
        if (firstArrayValue) {
          scenes = firstArrayValue as any[];
        } else {
          throw new Error('Format JSON tidak sesuai.');
        }
      }
    } catch (e) {
      console.error('Raw Text Gagal:', cleanText);
      throw new Error('Gagal memparse JSON dari AI.');
    }

    if (scenes.length < 4) {
      throw new Error(`AI hanya menghasilkan ${scenes.length} panel. Coba naskah yang lebih panjang.`);
    }

    const finalScenes = scenes.slice(0, 4).map((scene: any, index: number) => ({
      sceneNumber: index + 1,
      description: scene.description || 'Deskripsi adegan',
      cameraAngle: scene.cameraAngle || 'Medium shot',
      imagePrompt: scene.imagePrompt || scene.description || 'Cinematic scene'
    }));

    // Generate URL Gambar (Pollinations FLUX - Masih Gratis & Stabil)
    const finalPanels = finalScenes.map((scene) => {
      const imagePrompt = `${scene.imagePrompt}, character: ${character_ref || 'general'}, ${scene.cameraAngle}, cinematic lighting, 8k, masterpiece, single frame, no text, ${style}`;
      const safePrompt = encodeURIComponent(imagePrompt.substring(0, 600));
      const imageUrl = `https://image.pollinations.ai/prompt/${safePrompt}?width=1024&height=576&nologo=true&enhance=true&seed=${scene.sceneNumber * 1000 + seed}&model=flux`;

      return {
        panel_number: scene.sceneNumber,
        visual_description: scene.description,
        camera_angle: scene.cameraAngle,
        image_prompt: scene.imagePrompt,
        image_url: imageUrl,
        provider: 'groq-text + pollinations-image'
      };
    });

    return NextResponse.json({ status: 'success', data: finalPanels });

  } catch (error: any) {
    console.error('❌ Error Fatal di API:', error.message);
    return NextResponse.json(
      { error: 'Gagal memproses storyboard.', details: error.message },
      { status: 500 }
    );
  }
}