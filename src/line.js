const FORM_URL_BASE = 'https://docs.google.com/forms/d/e/1FAIpQLSfFuPT4v-FU5xHs-fK9vZqDVRhZoaOxsXu3bUPRcRgnBV3f4A/viewform?usp=pp_url&entry.2046907294=';

const FORM_TRIGGER_WORDS = ['form', 'แบบฟอร์ม', 'ฟอร์ม'];

export function shouldSendForm(event) {
  const isFollow = event.type === 'follow';
  const isFormRequest = event.type === 'message' &&
    event.message?.type === 'text' &&
    FORM_TRIGGER_WORDS.some(word =>
      event.message.text.toLowerCase().includes(word.toLowerCase())
    );

  return isFollow || isFormRequest;
}

export function buildFormUrl(userId) {
  return FORM_URL_BASE + encodeURIComponent(userId);
}

export async function replyLineMessage(replyToken, formUrl) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `ลูกค้าสามารถแจ้งข้อมูลผ่านแบบสอบถามความต้องการเบื้องต้นด้านล่าง เพื่อให้บริษัทฯดำเนินการและแจ้งข้อมูลตอบกลับลูกค้าต่อไปนะคะ: \n${formUrl}`,
        }
      ],
    }),
  });

  const data = await response.json();
  console.log('LINE reply response:', JSON.stringify(data, null, 2));

  if (data.message && data.message !== 'ok') {
    throw new Error(`LINE reply failed: ${data.message}`);
  }

  return data;
}