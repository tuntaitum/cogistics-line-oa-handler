import 'dotenv/config';

const BASE_APP_TOKEN = 'Vy7sbAtPnawdOXsK9tMlqlq3gGg';
const VOICE_DATA_TABLE_ID = 'tblxoutA6d73t44m';

async function getTenantAccessToken() {
  const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: process.env.LARK_APP_ID,
      app_secret: process.env.LARK_APP_SECRET,
    }),
  });
  const data = await response.json();
  if (data.code !== 0) throw new Error(`Failed to get tenant token: ${data.msg}`);
  return data.tenant_access_token;
}

function voiceFields(formData) {

  const isVeggie = formData.solution === 'veggie';

  return {
    'Client': formData.company,
    'ชื่อผู้ติดต่อ': formData.contact,
    'อีเมลผู้ติดต่อ': formData.email,
    'เบอร์ผู้ติดต่อ': formData.phone,
    'Cogistics Solution': isVeggie ? 'Vegetable Industry Solutions' : 'Food Pipeline Solutions',
    'ท่านรู้จัก Cogistics ผ่านช่องทางใด': formData.referral,
    'ข้อมูลเพิ่มเติม': formData.extraInfo,
    'LINE ID': formData.lineUserId,
    'ตลาด': formData.market ? formData.market.split(', ') : [],
    'สินค้าหลักของบริษัท': formData.mainProduct,
    // Veggie fields
    ...(isVeggie && {
      'สินค้าที่กำลังตามหา': formData.vegProduct,
      'สินค้า End Product': formData.vegEndProduct,
      'ปริมาณการใช้งาน': formData.vegVolume,
      'ปัญหาฝั่งลูกค้า': formData.vegPainPoints,
      'อธิบาย Solution': formData.vegDetails,
    }),
    // 3PL fields
    ...(!isVeggie && {
      '(3PL) สินค้ากับขนาดสินค้า': formData.foodProduct,
      '(3PL) ประเภทของสินค้า': formData.foodType,
      '(3PL) ปริมาณการใช้งาน': formData.foodVolume,
      '(3PL) สถานที่ตั้งต้นของสินค้า': formData.foodOrigin,
      '(3PL) อุณหภูมิที่ต้องใช้ในการจัดเก็บ': formData.foodStorageTemp,
      '(3PL) อุณหภูมิที่ต้องใช้ในการขนส่ง': formData.foodTransportTemp,
      '(3PL) จุดหมายปลายทางของสินค้า': formData.foodEndpoints,
    }),
  };
}

export async function saveVoiceRecord(formData) {
  return writeRecord(VOICE_DATA_TABLE_ID, voiceFields(formData));
}

function draftTableId() {
  const tableId = process.env.LARK_DRAFT_TABLE_ID;
  if (!/^tbl[a-zA-Z0-9]+$/.test(tableId ?? '') || tableId === VOICE_DATA_TABLE_ID) {
    throw new Error('Configure LARK_DRAFT_TABLE_ID with the test table ID');
  }
  return tableId;
}

export async function createDraftVoice(formData, requestId) {
  const fields = voiceFields(formData);
  const contactFields = ['Client', 'ชื่อผู้ติดต่อ', 'อีเมลผู้ติดต่อ', 'เบอร์ผู้ติดต่อ', 'Cogistics Solution', 'LINE ID'];
  return writeRecord(
    draftTableId(),
    Object.fromEntries(contactFields.map(key => [key, fields[key]])),
    { requestId },
  );
}

export async function updateDraftVoice(recordId, formData) {
  const fields = voiceFields(formData);
  for (const key of ['Client', 'ชื่อผู้ติดต่อ', 'อีเมลผู้ติดต่อ', 'เบอร์ผู้ติดต่อ', 'Cogistics Solution', 'LINE ID']) {
    delete fields[key];
  }
  return writeRecord(draftTableId(), fields, { recordId });
}

async function writeRecord(tableId, fields, { recordId, requestId } = {}) {
  const token = await getTenantAccessToken();
  const url = new URL(`https://open.larksuite.com/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${tableId}/records`);
  if (recordId) url.pathname += `/${encodeURIComponent(recordId)}`;
  if (requestId) url.searchParams.set('client_token', requestId);

  const response = await fetch(url, {
    method: recordId ? 'PUT' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) throw new Error(`Lark write failed: ${data.code}`);
  return data.data?.record?.record_id;
}
