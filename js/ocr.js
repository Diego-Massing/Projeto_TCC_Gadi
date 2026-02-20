// ===== OCR MODULE — Receipt Reading with Gemini Vision =====
// Reads fuel receipts using Google Gemini Vision API

const OCR = {
    // Gemini API key (stored in Supabase settings)
    apiKey: null,

    async loadApiKey() {
        try {
            const settings = await db.getAll('settings');
            const setting = settings.find(s => s.key === 'geminiApiKey');
            if (setting) this.apiKey = setting.value;
        } catch (e) {
            console.log('OCR: No API key found in settings');
        }
    },

    async setApiKey(key) {
        this.apiKey = key;
        await db.setSetting('geminiApiKey', key);
    },

    // Convert file to base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // Compress image before sending (receipts can be large photos)
    async compressImage(file, maxWidth = 800) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let w = img.width, h = img.height;
                if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                canvas.toBlob((blob) => {
                    URL.revokeObjectURL(url);
                    resolve(blob);
                }, 'image/jpeg', 0.85);
            };
            img.src = url;
        });
    },

    // Extract fueling data from receipt image using Gemini
    async extractFromReceipt(file) {
        if (!this.apiKey) {
            throw new Error('Chave da API Gemini não configurada. Vá em Configurações para adicionar.');
        }

        // Compress the image first
        const compressed = await this.compressImage(file);
        const base64 = await this.fileToBase64(compressed);

        const prompt = `Analise esta imagem de um cupom fiscal / nota de abastecimento de combustível e extraia os seguintes dados em formato JSON puro (sem markdown, sem backticks):

{
  "litros": (número decimal, quantidade de litros abastecidos),
  "valorLitro": (número decimal, valor por litro),
  "valorTotal": (número decimal, valor total pago),
  "posto": (nome do posto/estabelecimento),
  "data": (data no formato YYYY-MM-DD),
  "tipoCombustivel": (tipo do combustível: "Diesel", "Diesel S-10", "Gasolina", "Etanol", "Arla" ou outro),
  "km": (quilometragem se visível, senão null)
}

IMPORTANTE:
- Use números ponto flutuante (ex: 5.45, não 5,45)
- Se não conseguir ler algum campo, use null
- Retorne APENAS o JSON, sem texto adicional
- Se a imagem não for um cupom de abastecimento, retorne {"erro": "Imagem não parece ser um cupom de abastecimento"}`;

        // Try multiple models (fallback for quota/availability)
        const models = ['gemini-1.5-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-flash'];
        let response = null;
        let lastError = null;

        for (const model of models) {
            try {
                response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                { text: prompt },
                                { inline_data: { mime_type: 'image/jpeg', data: base64 } }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 500
                        }
                    })
                });

                if (response.ok) break; // Success!

                const err = await response.json().catch(() => ({}));
                lastError = err.error?.message || response.statusText;
                console.warn(`OCR: Model ${model} failed (${response.status}): ${lastError}`);

                // If it's a definitive auth error (API key invalid), don't try other models
                if (response.status === 403 && lastError.toLowerCase().includes('api key')) {
                    throw new Error('Chave da API Gemini inválida. Verifique em Configurações.');
                }

                // For 429 (rate limit) or quota errors, try next model
                if (response.status === 429) {
                    console.warn(`OCR: Rate limited on ${model}, trying next...`);
                    response = null;
                    continue;
                }

                response = null; // Reset so we try next model
            } catch (e) {
                if (e.message.includes('inválida')) throw e;
                lastError = e.message;
                console.warn(`OCR: Model ${model} error: ${e.message}`);
            }
        }

        if (!response || !response.ok) {
            throw new Error(`Erro na API Gemini: ${lastError || 'Todos os modelos falharam'}. Verifique sua chave em aistudio.google.com`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('A IA não conseguiu ler a imagem. Tente com uma foto mais nítida.');
        }

        // Parse JSON from response (handle markdown code blocks)
        let jsonStr = text.trim();
        if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
        }

        try {
            const data = JSON.parse(jsonStr);
            if (data.erro) throw new Error(data.erro);
            return data;
        } catch (e) {
            if (e.message.includes('cupom')) throw e;
            console.error('OCR parse error, raw:', text);
            throw new Error('Não foi possível interpretar o cupom. Tente com uma foto mais clara.');
        }
    },

    // Fill form fields with extracted data
    fillFuelingForm(data) {
        const fields = {
            'f-litros': data.litros,
            'f-valorLitro': data.valorLitro,
            'f-valorTotal': data.valorTotal,
            'f-posto': data.posto,
            'f-data': data.data,
            'f-km': data.km
        };

        let filled = 0;
        for (const [id, value] of Object.entries(fields)) {
            if (value != null && value !== '') {
                const el = document.getElementById(id);
                if (el) { el.value = value; filled++; }
            }
        }

        // Set combustible type
        if (data.tipoCombustivel) {
            const tipEl = document.getElementById('f-tipoComb');
            if (tipEl) {
                // Try to match
                const options = Array.from(tipEl.options);
                const match = options.find(o =>
                    o.value.toLowerCase().includes(data.tipoCombustivel.toLowerCase()) ||
                    data.tipoCombustivel.toLowerCase().includes(o.value.toLowerCase())
                );
                if (match) tipEl.value = match.value;
            }
        }

        // Trigger total calculation
        if (typeof Pages?.fuelings?.calcTotal === 'function') {
            Pages.fuelings.calcTotal();
        }

        return filled;
    }
};
