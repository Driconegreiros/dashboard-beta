const fs = require('fs');
const path = require('path');

function loadJson(filename) {
    try {
        return JSON.parse(fs.readFileSync(path.join(process.cwd(), filename), 'utf8'));
    } catch {
        return null;
    }
}

function summarizeDimension(data, dimension) {
    const dim = data?.dimensions?.[dimension];
    if (!dim) return 'Não disponível';
    return Object.entries(dim.totals)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}: ${v.toLocaleString('pt-BR')}`)
        .join(' | ');
}

function summarizeYears(data) {
    if (!data?.global_by_year) return 'Não disponível';
    return Object.entries(data.global_by_year)
        .sort((a, b) => a[0] - b[0])
        .map(([y, d]) => `${y}: ${d.total}`)
        .join(' | ');
}

function topEntries(obj, n = 10) {
    return Object.entries(obj || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
}

function summarizeTopClassesAssuntos(data) {
    const allClasses = {};
    const allAssuntos = {};
    Object.values(data?.global_by_year || {}).forEach(y => {
        Object.entries(y.classes || {}).forEach(([k, v]) => allClasses[k] = (allClasses[k] || 0) + v);
        Object.entries(y.assuntos || {}).forEach(([k, v]) => allAssuntos[k] = (allAssuntos[k] || 0) + v);
    });
    return {
        classes: topEntries(allClasses),
        assuntos: topEntries(allAssuntos)
    };
}

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

    const judicial = loadJson('data.json');
    const consultivo = loadJson('data_consultivo.json');

    const jTop = judicial ? summarizeTopClassesAssuntos(judicial) : { classes: 'N/A', assuntos: 'N/A' };
    const cTop = consultivo ? summarizeTopClassesAssuntos(consultivo) : { classes: 'N/A', assuntos: 'N/A' };

    const systemPrompt = `Você é um assistente de análise de dados de um dashboard judicial. Responda em português, de forma curta e direta. Nunca se apresente. Use os dados abaixo para embasar respostas. Use formatação brasileira para números. Se não tiver a informação, diga que não está disponível nos dados.

=== VISÃO ATUAL (filtro ativo) ===
${context || 'Sem contexto'}

=== JUDICIAL — Totais por Especializada ===
${summarizeDimension(judicial, 'Especializada')}

=== JUDICIAL — Evolução anual ===
${summarizeYears(judicial)}

=== JUDICIAL — Top 10 Classes ===
${jTop.classes}

=== JUDICIAL — Top 10 Assuntos ===
${jTop.assuntos}

=== CONSULTIVO — Totais por Órgão de Origem ===
${summarizeDimension(consultivo, 'Origem')}

=== CONSULTIVO — Totais por Área ===
${summarizeDimension(consultivo, 'Área')}

=== CONSULTIVO — Evolução anual ===
${summarizeYears(consultivo)}

=== CONSULTIVO — Top 10 Classes ===
${cTop.classes}

=== CONSULTIVO — Top 10 Assuntos ===
${cTop.assuntos}`;

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
            console.error('Claude API error:', JSON.stringify(data));
            return res.status(500).json({ error: `Erro na API: ${data?.error?.message || response.status}` });
        }

        return res.status(200).json({ content: data.content[0].text });
    } catch (error) {
        console.error('Erro interno:', error);
        return res.status(500).json({ error: 'Erro interno. Tente novamente.' });
    }
};
