import { createClient } from '@supabase/supabase-js';

const FEEDBACK_CATEGORIES = new Set([
  'bug_report',
  'feature_request',
  'improvement',
  'other',
]);

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

const isValidEmail = (value) =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const categoryLabels = {
  bug_report: 'Bug report',
  feature_request: 'Feature request',
  improvement: 'Improvement idea',
  other: 'Other feedback',
};

const sendConfirmationEmail = async ({ to, category, displayName }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FEEDBACK_FROM_EMAIL;
  const replyTo = process.env.FEEDBACK_REPLY_TO_EMAIL;

  if (!apiKey || !fromEmail) {
    return { sent: false, error: 'Email service is not configured.' };
  }

  const greetingName = displayName?.trim() || 'there';
  const categoryLabel = categoryLabels[category] || 'feedback';
  const subject = 'We received your Faith Notebook feedback';
  const text = [
    `Hi ${greetingName},`,
    '',
    `Thank you for sharing your ${categoryLabel.toLowerCase()} with Faith Notebook.`,
    'We received it successfully and really appreciate you taking the time to help improve the app.',
    '',
    'With gratitude,',
    'Fengchun (Jeffrey) Qiao',
    'Assistant Professor',
    'Bellini College of Artificial Intelligence, Cybersecurity and Computing',
    'University of South Florida',
    'https://joffery.github.io/joffery/',
  ].join('\n');

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; color: #2c1810; line-height: 1.6;">
      <p>Hi ${escapeHtml(greetingName)},</p>
      <p>
        Thank you for sharing your ${escapeHtml(categoryLabel.toLowerCase())} with Faith Notebook.
        We received it successfully and really appreciate you taking the time to help improve the app.
      </p>
      <p>With gratitude,</p>
      <p>
        Fengchun (Jeffrey) Qiao<br />
        Assistant Professor<br />
        Bellini College of Artificial Intelligence, Cybersecurity and Computing<br />
        University of South Florida<br />
        <a href="https://joffery.github.io/joffery/">https://joffery.github.io/joffery/</a>
      </p>
    </div>
  `;

  const payload = {
    from: fromEmail,
    to: [to],
    subject,
    text,
    html,
  };

  if (replyTo) {
    payload.reply_to = replyTo;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return {
      sent: false,
      error: `Email send failed: ${errorText || response.statusText || 'Unknown error'}`,
    };
  }

  return { sent: true, error: null };
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return json(res, 500, { error: 'Feedback service is not configured.' });
  }

  const category = String(req.body?.category || '').trim();
  const message = String(req.body?.message || '').trim();
  const contactEmail = String(req.body?.contactEmail || '').trim().toLowerCase();
  const userId = String(req.body?.userId || '').trim() || null;
  const displayName = String(req.body?.displayName || '').trim() || null;
  const username = String(req.body?.username || '').trim() || null;
  const churchAffiliation = String(req.body?.churchAffiliation || '').trim() || null;
  const source = String(req.body?.source || 'main_app').trim() || 'main_app';
  const metadata = req.body?.metadata && typeof req.body.metadata === 'object' && !Array.isArray(req.body.metadata)
    ? req.body.metadata
    : {};

  if (!FEEDBACK_CATEGORIES.has(category)) {
    return json(res, 400, { error: 'Please choose a feedback category.' });
  }

  if (message.length < 10) {
    return json(res, 400, { error: 'Please share a little more detail before submitting.' });
  }

  if (!isValidEmail(contactEmail)) {
    return json(res, 400, { error: 'Please enter a valid email address.' });
  }

  try {
    const { data, error } = await supabase
      .from('app_feedback')
      .insert({
        category,
        message,
        contact_email: contactEmail,
        user_id: userId,
        display_name: displayName,
        username,
        church_affiliation: churchAffiliation,
        source,
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.error('app-feedback insert failed:', error);
      return json(res, 500, { error: 'We could not save your feedback just now.' });
    }

    const feedbackId = data?.id;
    const emailResult = await sendConfirmationEmail({
      to: contactEmail,
      category,
      displayName,
    });

    if (feedbackId) {
      await supabase
        .from('app_feedback')
        .update({
          confirmation_email_sent_at: emailResult.sent ? new Date().toISOString() : null,
          confirmation_email_error: emailResult.sent ? null : emailResult.error,
        })
        .eq('id', feedbackId);
    }

    return json(res, 200, {
      ok: true,
      emailSent: emailResult.sent,
    });
  } catch (error) {
    console.error('app-feedback unexpected error:', error);
    return json(res, 500, { error: 'Unexpected feedback error.' });
  }
}
