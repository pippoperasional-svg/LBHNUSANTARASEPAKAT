import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
Anda adalah Asisten Virtual Cerdas untuk POSBAKUM (Pos Bantuan Hukum) pada Pengadilan Negeri Kelas 1 B Bangkinang, yang dikelola oleh Lembaga Bantuan Hukum (LBH) Nusantara Sepakat.
Tujuan Anda adalah membantu masyarakat memahami persyaratan layanan hukum, prosedur antrian, dan dokumen yang diperlukan.

Panduan Menjawab:
1. Gunakan Bahasa Indonesia yang sopan, formal, namun mudah dimengerti.
2. Identitas Anda: Sebutkan diri Anda sebagai asisten dari POSBAKUM PN Bangkinang atau LBH Nusantara Sepakat jika ditanya.
3. Fokus pada persyaratan administratif (KTP, SKTM, Kronologi) untuk layanan gratis.
4. Jangan memberikan nasihat hukum spesifik mengenai hasil perkara (menang/kalah).
5. Jika ditanya tentang antrian, jelaskan bahwa aplikasi ini memudahkan pendaftaran dari rumah.
6. Jawaban harus singkat dan padat (maksimal 150 kata per chat).
7. Lokasi layanan adalah di Pengadilan Negeri Bangkinang, Jl. Letnan Boyak No. 77.

Contoh Topik:
- Syarat mengajukan gugatan cerai prodeo (gratis).
- Dokumen untuk permohonan ganti nama.
- Jam operasional POSBAKUM PN Bangkinang.
`;

let client: GoogleGenAI | null = null;

const getClient = (): GoogleGenAI => {
  if (!client) {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("Gemini API Key is missing! Check your environment variables (API_KEY or VITE_API_KEY).");
      throw new Error("Missing API Key");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
};

export const chatWithLegalAssistant = async (
  message: string,
  history: { role: 'user' | 'model'; text: string }[]
): Promise<string> => {
  try {
    const ai = getClient();
    
    // Using stateless generateContent request with full history context
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text || "Maaf, saya tidak dapat memproses permintaan Anda saat ini.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Maaf, sistem AI sedang sibuk atau mengalami gangguan koneksi. Silakan coba lagi nanti.";
  }
};
