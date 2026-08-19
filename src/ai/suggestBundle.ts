export interface BundleSuggestion {
  title: string;
  description: string;
  tags: string[];
  usedAi: boolean;
}

function fallbackSuggest(docs: Array<{ title: string; documentNumber?: string }>): BundleSuggestion {
  const first = docs[0]?.title || 'Archive records';
  const tags = ['Dossier', 'Case File'];
  return {
    title: docs.length > 1 ? `Case Dossier: ${first.slice(0, 48)} Group` : `Dossier: ${first.slice(0, 60)}`,
    description: `Consolidated archive bundle containing ${docs.length} related document(s): ${docs.map(d => d.documentNumber || d.title).slice(0, 6).join(', ')}.`,
    tags,
    usedAi: false
  };
}

export async function suggestBundleFromDocuments(
  docs: Array<{ title: string; documentNumber?: string; subject?: string }>
): Promise<BundleSuggestion> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || docs.length === 0) {
    return fallbackSuggest(docs);
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: key });
    const listing = docs
      .map((d, i) => `${i + 1}. [${d.documentNumber || 'n/a'}] ${d.title}${d.subject ? ` — ${d.subject}` : ''}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `You help records officers name physical document dossiers.
Return ONLY compact JSON with keys title, description, tags (array of 2-5 short tags).
Documents:\n${listing}`
    });

    const text = (response as { text?: string }).text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackSuggest(docs);
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: String(parsed.title || fallbackSuggest(docs).title),
      description: String(parsed.description || fallbackSuggest(docs).description),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: unknown) => String(t)).slice(0, 8) : ['Dossier'],
      usedAi: true
    };
  } catch (err) {
    console.warn('[AI] Bundle suggestion fallback:', (err as Error)?.message || err);
    return fallbackSuggest(docs);
  }
}
