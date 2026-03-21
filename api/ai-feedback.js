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

const getFeedbackConflictKinds = (feedbackKind) => {
  switch (feedbackKind) {
    case 'helpful':
    case 'not_helpful':
      return ['helpful', 'not_helpful'];
    case 'accurate':
    case 'inaccurate':
      return ['accurate', 'inaccurate'];
    case 'match_helpful':
    case 'match_not_relevant':
      return ['match_helpful', 'match_not_relevant'];
    case 'looks_wrong':
      return ['looks_wrong'];
    default:
      return feedbackKind ? [feedbackKind] : [];
  }
};

const buildLegacyFeedbackMatchQuery = (query, {
  question,
  answerPreview,
  surface,
  feedbackKind,
  targetRef,
  targetId,
}) => {
  let nextQuery = query
    .eq('answer_preview', answerPreview)
    .eq('surface', surface);

  if (question) {
    nextQuery = nextQuery.eq('question', question);
  } else {
    nextQuery = nextQuery.is('question', null);
  }

  if (feedbackKind) {
    nextQuery = nextQuery.eq('feedback_kind', feedbackKind);
  } else {
    nextQuery = nextQuery.is('feedback_kind', null);
  }

  if (targetRef) {
    nextQuery = nextQuery.eq('target_ref', targetRef);
  } else {
    nextQuery = nextQuery.is('target_ref', null);
  }

  if (targetId) {
    nextQuery = nextQuery.eq('target_id', targetId);
  } else {
    nextQuery = nextQuery.is('target_id', null);
  }

  return nextQuery;
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
  const answerPreview = answer.slice(0, 2000);
  const wasHelpful =
    typeof req.body?.wasHelpful === 'boolean'
      ? req.body.wasHelpful
      : feedbackKind === 'helpful' || feedbackKind === 'accurate' || feedbackKind === 'match_helpful';

  if (!feedbackKey) {
    return json(res, 400, { error: 'feedbackKey is required.' });
  }

  if (action === 'unset') {
    try {
      let { error } = await supabase
        .from('ai_feedback')
        .delete()
        .eq('feedback_key', feedbackKey);

      if (error && String(error.message || '').toLowerCase().includes('feedback_key')) {
        const fallback = await buildLegacyFeedbackMatchQuery(
          supabase.from('ai_feedback').delete(),
          {
            question,
            answerPreview,
            surface,
            feedbackKind,
            targetRef,
            targetId,
          }
        );
        error = fallback.error;
      }

      if (error) {
        console.error('ai-feedback delete failed:', error);
        return json(res, 200, { ok: false, error: 'Feedback delete failed.' });
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('ai-feedback delete unexpected error:', error);
      return json(res, 200, { ok: false, error: 'Unexpected feedback delete error.' });
    }
  }

  if (!answer) {
    return json(res, 400, { error: 'Answer is required.' });
  }

  try {
    if (feedbackGroupKey) {
      let { error: cleanupError } = await supabase
        .from('ai_feedback')
        .delete()
        .eq('feedback_group_key', feedbackGroupKey)
        .neq('feedback_key', feedbackKey);

      if (cleanupError && String(cleanupError.message || '').toLowerCase().includes('feedback_group_key')) {
        const conflictKinds = getFeedbackConflictKinds(feedbackKind);
        const fallbackCleanup = await supabase
          .from('ai_feedback')
          .delete()
          .eq('answer_preview', answerPreview)
          .eq('surface', surface)
          .in('feedback_kind', conflictKinds);

        cleanupError = fallbackCleanup.error;
      }

      if (cleanupError) {
        console.error('ai-feedback cleanup failed:', cleanupError);
        return json(res, 200, { ok: false, error: 'Feedback cleanup failed.' });
      }
    }

    let { error } = await supabase.from('ai_feedback').upsert({
      question: question || null,
      answer_preview: answerPreview,
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

    if (
      error &&
      (
        String(error.message || '').toLowerCase().includes('feedback_key') ||
        String(error.message || '').toLowerCase().includes('feedback_group_key') ||
        String(error.message || '').toLowerCase().includes('there is no unique or exclusion constraint matching')
      )
    ) {
      const fallback = await supabase.from('ai_feedback').insert({
        question: question || null,
        answer_preview: answerPreview,
        was_helpful: wasHelpful,
        surface,
        feedback_kind: feedbackKind || null,
        target_ref: targetRef || null,
        target_id: targetId || null,
      });
      error = fallback.error;
    }

    if (error) {
      console.error('ai-feedback insert failed:', error);
      return json(res, 200, { ok: false, error: 'Feedback insert failed.' });
    }

    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('ai-feedback unexpected error:', error);
    return json(res, 200, { ok: false, error: 'Unexpected feedback error.' });
  }
}
