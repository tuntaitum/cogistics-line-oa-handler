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
  return `https://form.cogistics.co.th/form?uid=${encodeURIComponent(userId)}`;
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

export async function sendThankYouMessage(lineUserId, contact, company) {
  if (!lineUserId) {
    console.log('No LINE ID — skipping thank you message');
    return;
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [
        {
          type: 'text',
          text: `ขอบคุณ คุณ ${contact} ที่กรอกฟอร์มมาในนามของ ${company} ค่ะ จะมีทีมงานติดต่อกลับมาอีกทีนะคะ`,
        }
      ],
    }),
  });

  const data = await response.json();
  console.log('Thank you message response:', JSON.stringify(data, null, 2));
}