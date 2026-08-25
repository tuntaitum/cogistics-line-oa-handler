import 'dotenv/config';

const BASE_APP_TOKEN = 'Vy7sbAtPnawdOXsK9tMlqlq3gGg';
const VOICE_DATA_TABLE_ID = 'tblKp0JCK0qhd22y';

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
  console.log('Token response:', JSON.stringify(data, null, 2)); // add this
  if (data.code !== 0) throw new Error(`Failed to get tenant token: ${data.msg}`);
  return data.tenant_access_token;
}

export async function saveVoiceRecord(formData) {
  const token = await getTenantAccessToken();

  const isVeggie = formData.solution === 'veggie';

  const fields = {
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

  const fieldsJson = JSON.stringify(fields, null, 2);
  console.log('Fields length:', fieldsJson.length);
  console.log('Fields part 1:', fieldsJson.substring(0, 1000));
  console.log('Fields part 2:', fieldsJson.substring(1000));
  const response = await fetch(`https://open.larksuite.com/open-apis/bitable/v1/apps/${BASE_APP_TOKEN}/tables/${VOICE_DATA_TABLE_ID}/records`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  });

  const responseText = await response.text();
  console.log('Full Lark response:', responseText);
  const data = JSON.parse(responseText);

  if (data.code !== 0) throw new Error(`Failed to save record: ${data.msg}`);
  return data.data?.record?.record_id;
}