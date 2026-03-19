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

    const systemPrompt = `Você é um assistente de análise de dados de um dashboard judicial. Responda em português, de forma curta e direta. Regras: nunca se apresente, nunca liste dados espontaneamente, responda apenas o que foi perguntado, use os dados abaixo somente quando a resposta exigir. Use formatação brasileira para números.

Dashboard:
${context || 'Sem contexto'}`;

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
