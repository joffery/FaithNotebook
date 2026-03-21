import { createClient } from '@supabase/supabase-js';

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceKey);
};

const json = (res, status, body) => {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json(res, 200, { ok: false });
  }

  const question = String(req.body?.question || '').trim();
  const answer = String(req.body?.answer || '').trim();
  const feedbackKind = String(req.body?.feedbackKind || '').trim();
  const surface = String(req.body?.surface || 'ai_chat').trim() || 'ai_chat';
  const targetRef = String(req.body?.targetRef || '').trim();
  const targetId = String(req.body?.targetId || '').trim();
  const feedbackKey = String(req.body?.feedbackKey || '').trim();
  const feedbackGroupKey = String(req.body?.feedbackGroupKey || '').trim();
  const action = String(req.body?.action || 'set').trim() || 'set';
  const wasHelpful =
    typeof req.body?.wasHelpful === 'boolean'
      ? req.body.wasHelpful
      : feedbackKind === 'helpful' || feedbackKind === 'accurate' || feedbackKind === 'match_helpful';

  if (!feedbackKey) {
    return json(res, 400, { error: 'feedbackKey is required.' });
  }

  if (action === 'unset') {
    try {
      const { error } = await supabase
        .from('ai_feedback')
        .delete()
        .eq('feedback_key', feedbackKey);

      if (error) {
        console.error('ai-feedback delete failed:', error);
        return json(res, 200, { ok: false });
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('ai-feedback delete unexpected error:', error);
      return json(res, 200, { ok: false });
    }
  }

  if (!answer) {
    return json(res, 400, { error: 'Answer is required.' });
  }

  try {
    if (feedbackGroupKey) {
      const { error: cleanupError } = await supabase
        .from('ai_feedback')
        .delete()
        .eq('feedback_group_key', feedbackGroupKey)
        .neq('feedback_key', feedbackKey);

      if (cleanupError) {
        console.error('ai-feedback cleanup failed:', cleanupError);
        return json(res, 200, { ok: false });
      }
    }

    const { error } = await supabase.from('ai_feedback').upsert({
      question: question || null,
      answer_preview: answer.slice(0, 2000),
      was_helpful: wasHelpful,
      surface,
      feedback_kind: feedbackKind || null,
      target_ref: targetRef || null,
      target_id: targetId || null,
      feedback_key: feedbackKey,
      feedback_group_key: feedbackGroupKey || null,
    }, {
      onConflict: 'feedback_key',
    });

    if (error) {
      console.error('ai-feedback insert failed:', error);
      return json(res, 200, { ok: false });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('ai-feedback unexpected error:', error);
    return json(res, 200, { ok: false });
  }
}
