export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server AI key is not configured' });
  }

  const { fullContext, userMessage } = req.body || {};
  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  const responseInstruction = [
    'No greetings or preamble.',
    'Output exactly 6 bullet points.',
    'Each bullet must be 18 words or fewer.',
    'Each bullet must be a complete sentence.',
    'After bullets, output exactly 1 summary sentence.',
  ].join(' ');

  const callGemini = async (modelName) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: responseInstruction,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: `System rule: ${responseInstruction}`,
                },
                {
                  text: `You are a helpful Bible study assistant with access to sermons and community notes.

${fullContext || ''}

User question: ${userMessage}

Provide a thoughtful, biblically-grounded response. When relevant, reference specific sermons by title and speaker, or mention insights from community notes. Follow the output format strictly.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    const data = await response.json();
    return { response, data };
  };

  try {
    let modelUsed = 'gemini-2.5-flash';
    let { response, data } = await callGemini(modelUsed);

    if (response.ok && data?.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
      modelUsed = 'gemini-2.0-flash';
      ({ response, data } = await callGemini(modelUsed));

      if (!response.ok || !data?.candidates?.length) {
        modelUsed = 'gemini-1.5-flash';
        ({ response, data } = await callGemini(modelUsed));
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Failed to get response from Gemini',
      });
    }

    const candidate = data?.candidates?.[0] || null;
    const parts = candidate?.content?.parts || [];
    const aiResponse = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim() || 'Sorry, I could not generate a response.';
    const finishReason = data?.candidates?.[0]?.finishReason || null;
    const usageMetadata = data?.usageMetadata || null;

    return res.status(200).json({
      aiResponse,
      finishReason,
      usageMetadata,
      contextCharCount: (fullContext || '').length,
      modelUsed,
    });
  } catch (error) {
    console.error('Server error calling Gemini:', error);
    return res.status(500).json({ error: 'AI request failed on server' });
  }
}
