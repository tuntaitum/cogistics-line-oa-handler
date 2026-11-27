import 'dotenv/config';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { saveVoiceRecord, createDraftVoice, updateDraftVoice } from './larkbase.js';
import { shouldSendForm, buildFormUrl, replyLineMessage, sendThankYouMessage } from './line.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());

// Serve files inside /public as static files
app.use(express.static(join(__dirname, '../public')));

app.get('/ping', (req, res) => {

  res.json({ status: 'alive' });

});

app.get('/', (req, res) => {
  res.redirect('/form');
});

app.get('/form', (req, res) => {

  const html = readFileSync(join(__dirname, '../public/form.html'), 'utf-8');

  res.send(html);

});

app.post('/form/submit', async (req, res) => {
  console.log('Form submit received');
  res.status(200).json({ success: true });

  const formData = req.body;
  console.log('Submission:', formData.company, '|', formData.solution);

  try {
    await Promise.all([
      saveVoiceRecord(formData),
      sendThankYouMessage(formData.lineUserId, formData.contact, formData.company),
    ]);
    console.log('Form submission processed successfully');
  } catch (error) {
    console.error('Form submission error:', error.message);
    console.error('Stack:', error.stack);
  }
});

function signDraft(payload) {
  return createHmac('sha256', process.env.LARK_APP_SECRET)
    .update(`draft-voice:${process.env.LARK_DRAFT_TABLE_ID}:${payload}`)
    .digest('base64url');
}

function readDraftToken(token) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;
  const expected = Buffer.from(signDraft(payload));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  const [recordId, solution, expiresAt] = payload.split(':');
  if (!/^rec[a-zA-Z0-9]+$/.test(recordId) || Number(expiresAt) <= Date.now()) return null;
  return { recordId, solution };
}

app.post('/form/draft/contact', async (req, res) => {
  if (!process.env.LARK_DRAFT_TABLE_ID) return res.sendStatus(404);

  const { requestId, solution, lineUserId, ...body } = req.body ?? {};
  const fields = ['company', 'contact', 'email', 'phone'];
  if (
    !['veggie', 'food'].includes(solution) ||
    typeof requestId !== 'string' ||
    !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(requestId) ||
    !fields.every(key => typeof body[key] === 'string' && body[key].trim()) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())
  ) return res.sendStatus(400);

  const contact = Object.fromEntries(fields.map(key => [key, body[key].trim()]));
  try {
    const recordId = await createDraftVoice({
      ...contact, solution, lineUserId: typeof lineUserId === 'string' ? lineUserId : '',
    }, requestId);
    if (!recordId) throw new Error('Lark response missing record ID');
    const payload = `${recordId}:${solution}:${Date.now() + 2 * 60 * 60 * 1000}`;
    res.json({ token: `${payload}.${signDraft(payload)}` });
  } catch (error) {
    console.error('Draft contact save failed:', error.message);
    res.sendStatus(502);
  }
});

app.post('/form/draft/details', async (req, res) => {
  if (!process.env.LARK_DRAFT_TABLE_ID) return res.sendStatus(404);

  const { token, ...details } = req.body ?? {};
  const draft = readDraftToken(token);
  if (!draft) return res.sendStatus(403);
  const commonFields = ['market', 'mainProduct', 'referral', 'extraInfo'];
  const solutionFields = draft.solution === 'veggie'
    ? ['vegProduct', 'vegEndProduct', 'vegVolume', 'vegPainPoints', 'vegDetails']
    : ['foodProduct', 'foodType', 'foodVolume', 'foodOrigin', 'foodStorageTemp', 'foodTransportTemp', 'foodEndpoints'];
  const fields = [...commonFields, ...solutionFields];
  if (!fields.every(key => typeof details[key] === 'string') ||
      !details.market.trim() || !details.mainProduct.trim()) return res.sendStatus(400);

  try {
    await updateDraftVoice(draft.recordId, {
      ...Object.fromEntries(fields.map(key => [key, details[key]])),
      solution: draft.solution,
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Draft details save failed:', error.message);
    res.sendStatus(502);
  }
});

app.post('/line-webhook', async (req, res) => {
  // LINE requires immediate 200 response
  res.status(200).json({ status: 'ok' });

  const events = req.body?.events || [];
  console.log(`Received ${events.length} LINE event(s)`);

  for (const event of events) {
    try {
      const userId = event.source?.userId;
      const replyToken = event.replyToken;

      console.log('Event type:', event.type);
      console.log('User ID:', userId);

      if (!userId || !replyToken) continue;
      if (!shouldSendForm(event)) continue;

      const formUrl = buildFormUrl(userId);
      console.log('Sending form URL:', formUrl);

      await replyLineMessage(replyToken, formUrl);
      console.log('Reply sent successfully');

    } catch (error) {
      console.error('Event error:', error.message);
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`LINE OA Handler running on port ${PORT}`);
});