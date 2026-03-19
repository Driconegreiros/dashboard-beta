const fs = require('fs');
const path = require('path');

// ─── Carregamento e processamento na inicialização do módulo ─────────────────
// Em funções "quentes" do Vercel, o módulo é reutilizado entre requisições,
// então os dados ficam em memória e o arquivo não é relido a cada chamada.

function loadJson(filename) {
    for (const base of [path.join(__dirname, '..'), process.cwd()]) {
        try { return JSON.parse(fs.readFileSync(path.join(base, filename), 'utf8')); } catch {}
    }
    console.error(`[chat] Não foi possível carregar ${filename}`);
    return null;
}

function normKey(k) {
    return String(k).replace(/\\/g, '/');
}

function buildDimensionSummary(data, dimension) {
    const totals = data?.dimensions?.[dimension]?.totals;
    if (!totals) return 'Não disponível';
    return Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${normKey(k)}: ${v}`)
        .join(' | ');
}

function buildYearSummary(data) {
    if (!data?.global_by_year) return 'Não disponível';
    return Object.entries(data.global_by_year)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([y, d]) => `${y}: ${d.total}`)
        .join(' | ');
}

function buildTopSummary(data, n = 10) {
    const classes = {};
    const assuntos = {};
    Object.values(data?.global_by_year || {}).forEach(y => {
        Object.entries(y.classes || {}).forEach(([k, v]) => { classes[k] = (classes[k] || 0) + v; });
        Object.entries(y.assuntos || {}).forEach(([k, v]) => { assuntos[k] = (assuntos[k] || 0) + v; });
    });
    const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, v]) => `${normKey(k)}: ${v}`).join(' | ');
    return { classes: top(classes), assuntos: top(assuntos) };
}

// Processado uma única vez na inicialização do container
const judicial = loadJson('data.json');
const consultivo = loadJson('data_consultivo.json');

const DATA_CONTEXT = `
=== JUDICIAL — Especializadas (total histórico) ===
${buildDimensionSummary(judicial, 'Especializada')}

=== JUDICIAL — Evolução anual ===
${buildYearSummary(judicial)}

=== JUDICIAL — Top 10 Classes ===
${buildTopSummary(judicial).classes}

=== JUDICIAL — Top 10 Assuntos ===
${buildTopSummary(judicial).assuntos}

=== CONSULTIVO — Órgãos de Origem (total histórico) ===
${buildDimensionSummary(consultivo, 'Origem')}

=== CONSULTIVO — Áreas (total histórico) ===
${buildDimensionSummary(consultivo, 'Área')}

=== CONSULTIVO — Evolução anual ===
${buildYearSummary(consultivo)}

=== CONSULTIVO — Top 10 Classes ===
${buildTopSummary(consultivo).classes}

=== CONSULTIVO — Top 10 Assuntos ===
${buildTopSummary(consultivo).assuntos}
`.trim();

// ─── Handler ─────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Mensagens inválidas' });
    }

    const systemPrompt = `Você é um assistente de análise de dados de um dashboard judicial. Responda em português, de forma curta e direta. Nunca se apresente. Use apenas os dados fornecidos abaixo. Use formatação brasileira para números. Se não houver a informação, diga que não está disponível.

=== FILTRO ATIVO NO DASHBOARD ===
${context || 'Não informado'}

${DATA_CONTEXT}`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 400,
                system: systemPrompt,
                messages: messages.slice(-6)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[chat] Claude API error:', JSON.stringify(data));
            return res.status(500).json({ error: `Erro na API: ${data?.error?.message || response.status}` });
        }

        return res.status(200).json({ content: data.content[0].text });
    } catch (error) {
        console.error('[chat] Erro interno:', error);
        return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
    }
};
