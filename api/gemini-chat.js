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

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are a helpful Bible study assistant with access to sermons and community notes.

${fullContext || ''}

User question: ${userMessage}

Provide a thoughtful, biblically-grounded response. When relevant, reference specific sermons by title and speaker, or mention insights from community notes. Be conversational and helpful.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Failed to get response from Gemini',
      });
    }

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
    const finishReason = data?.candidates?.[0]?.finishReason || null;
    const usage = data?.usageMetadata || null;

    return res.status(200).json({
      aiResponse,
      finishReason,
      usage,
    });
  } catch (error) {
    console.error('Server error calling Gemini:', error);
    return res.status(500).json({ error: 'AI request failed on server' });
  }
}
