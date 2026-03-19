// Cache — carregado na primeira requisição e reutilizado nas seguintes
let DATA_CONTEXT = null;

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

function buildComarcaSummary(data) {
    // comarca -> { total, por especializada }
    const comarcas = {};
    const prefixRegex = /^(Comarca|Subseção Judiciária|Seção Judiciária) (de |do |da )?/i;
    const norm = c => c.replace(prefixRegex, '').trim();

    // Total por comarca (via global_by_year)
    Object.values(data?.global_by_year || {}).forEach(y => {
        Object.entries(y.comarcas || {}).forEach(([c, v]) => {
            const name = norm(c);
            if (!comarcas[name]) comarcas[name] = { total: 0, esp: {} };
            comarcas[name].total += v;
        });
    });

    // Desagregação por especializada e assunto (via dimensions.Especializada.by_year)
    const espByYear = data?.dimensions?.Especializada?.by_year || {};
    Object.entries(espByYear).forEach(([esp, years]) => {
        Object.values(years).forEach(yData => {
            Object.entries(yData.comarcas || {}).forEach(([c, v]) => {
                const name = norm(c);
                if (!comarcas[name]) comarcas[name] = { total: 0, esp: {}, assuntos: {} };
                comarcas[name].esp[esp] = (comarcas[name].esp[esp] || 0) + v;
            });
        });
    });

    // Assuntos por comarca via global_by_year (assuntos não vêm desagregados por comarca no JSON)
    // Portanto agregamos assuntos globais do dataset para uso geral
    const assuntosGlobais = {};
    Object.values(data?.global_by_year || {}).forEach(y => {
        Object.entries(y.assuntos || {}).forEach(([a, v]) => {
            assuntosGlobais[a] = (assuntosGlobais[a] || 0) + v;
        });
    });
    const topAssuntosGlobais = Object.entries(assuntosGlobais)
        .sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([k, v]) => `${k}:${v}`).join(',');

    return Object.entries(comarcas)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([k, v]) => {
            const espStr = Object.entries(v.esp)
                .sort((a, b) => b[1] - a[1])
                .map(([e, n]) => `${e}:${n}`)
                .join(',');
            return `${k}(total:${v.total}|esp:${espStr})`;
        })
        .join(' | ') + `\n\nTop 10 Assuntos globais (judicial): ${topAssuntosGlobais}`;
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

async function buildDataContext(baseUrl) {
    const [judicial, consultivo] = await Promise.all([
        fetch(`${baseUrl}/data.json`).then(r => r.json()).catch(() => null),
        fetch(`${baseUrl}/data_consultivo.json`).then(r => r.json()).catch(() => null),
    ]);

    console.log('[chat] judicial ok:', !!judicial, '| consultivo ok:', !!consultivo);

    return `
=== JUDICIAL — Especializadas (total histórico) ===
${buildDimensionSummary(judicial, 'Especializada')}

=== JUDICIAL — Evolução anual ===
${buildYearSummary(judicial)}

=== JUDICIAL — Top 10 Classes ===
${buildTopSummary(judicial).classes}

=== JUDICIAL — Top 10 Assuntos ===
${buildTopSummary(judicial).assuntos}

=== JUDICIAL — Processos por Município/Comarca (interior do Amazonas) ===
${buildComarcaSummary(judicial)}

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
}

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

    // Monta a base URL a partir do host da requisição
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (!DATA_CONTEXT) {
        DATA_CONTEXT = await buildDataContext(baseUrl);
    }

    const systemPrompt = `Você é um assistente de análise de dados de um dashboard jurídico com acesso TOTAL e IRRESTRITO a todos os dados, independente da aba ou filtro ativo no dashboard.

Você conhece integralmente:
- JUDICIAL: todos os processos das varas especializadas (1997–2026)
- CONSULTIVO: todos os pareceres e demandas por órgão de origem e por área (2018–2026)

Regras:
- Responda em português, de forma curta e direta
- Nunca se apresente
- O contexto do dashboard abaixo é apenas informativo — indica o que o usuário está vendo agora, mas NUNCA limita suas respostas
- Você pode e deve responder sobre qualquer dado dos dois datasets, mesmo que o filtro ativo seja diferente
- Use formatação brasileira para números (ex: 1.234 ou 12,5%)
- Quando a pergunta pedir especificamente um número ou valor, responda APENAS com o número, sem frases adicionais
- Se um dado realmente não existir nos datasets, informe que não está disponível

=== CONTEXTO ATUAL DO DASHBOARD (apenas informativo) ===
${context || 'Nenhum filtro ativo'}

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
