import 'dotenv/config';
import express from 'express';
import { shouldSendForm, buildFormUrl, replyLineMessage } from './line.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(express.json());

// Serve files inside /public as static files
app.use(express.static(join(__dirname, '../public')));

app.get('/ping', (req, res) => {

  res.json({ status: 'alive' });

});

app.get('/form', (req, res) => {

  const html = readFileSync(join(__dirname, '../public/form.html'), 'utf-8');

  res.send(html);

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