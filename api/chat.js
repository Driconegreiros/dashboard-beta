import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Mensagens inválidas' });
    }

    const systemPrompt = `Você é um assistente de análise de dados do Dashboard Judicial e Consultivo do Tribunal de Justiça do Amazonas (TJAM). Seu papel é ajudar os usuários a interpretar os dados exibidos no dashboard.

Estado atual do dashboard:
${context || 'Contexto não disponível'}

Diretrizes:
- Responda sempre em português brasileiro
- Seja objetivo e direto
- Use os dados do contexto para embasar suas respostas
- Quando citar números, use formatação brasileira (ex: 1.234 ou 1.234,5%)
- Não invente dados que não estejam no contexto fornecido
- Se perguntado sobre algo fora do contexto, informe que não possui essa informação no filtro atual
- Você pode sugerir que o usuário ajuste os filtros do dashboard para obter diferentes perspectivas`;

    try {
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages: messages.slice(-10) // limita histórico a 10 mensagens
        });

        return res.status(200).json({ content: response.content[0].text });
    } catch (error) {
        console.error('Erro na API Claude:', error);
        return res.status(500).json({ error: 'Erro ao processar sua mensagem. Tente novamente.' });
    }
}
