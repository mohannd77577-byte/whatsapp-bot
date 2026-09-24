const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY' });

const vipContacts = [
  '967774098249', // قتيبه جواد
  '967774394493', // عدنان جواد
  '967770216882', // عماري
  '967774468123', // عمي عمار
  '967773241155', // عمي عمر
  '967779089438', // عمي عمر 3
  '96777353378',  // اسماعيل انور
  '967775828705', // احمد زكي
  '967771905685', // ابو سعيد عبده
  '967782805978', // راوح جواد
  '967775881409', // خالي احمد
  '967770871206', // حمودي اشرف
  '967778185805', // اصيل حلويات
  '967781089792', // عبودي بن مروان
  '967776497734', // صائل حسن
  '967778677603', // سام المؤيد
  '967781823376', // ريان علي
  '967772642404', // محمد اخو عصام
  '967775950922'  // عصام جديد
];

const lastReplied = new Map();

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) {
        console.log('🔄 إعادة الاتصال بالواتساب...');
        startBot();
      } else {
        console.log('⚠️ تم تسجيل الخروج من الواتساب.');
      }
    } else if (connection === 'open') {
      console.log('✅ تم الاتصال بنجاح بالواتساب وجاهز للعمل!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    if (!remoteJid || remoteJid.endsWith('@g.us')) return;

    let senderNumber = remoteJid.replace(/[^0-9]/g, '');
    if (msg.key.participant) {
      senderNumber = msg.key.participant.replace(/[^0-9]/g, '');
    }

    const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!messageText) return;

    console.log(`[رسالة واردة] من الرقم: ${senderNumber} | النص: ${messageText}`);

    const now = Date.now();
    const isVip = vipContacts.some(vip => senderNumber.endsWith(vip) || vip.endsWith(vip));

    if (isVip) {
      console.log(`⭐ [ذكاء اصطناعي VIP] يجري توليد رد بأسلوبك...`);
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `أنت مساعد شخصي ذكي ينوب عن مهند فهد محمد فارع الزريقي. مهند حاليا مشغول أو غير متوفر. قم بالرد على هذه الرسالة الواردة من شخص مهم (VIP) بأسلوب مهند الودود، الذكي، والطبيعي تماماً باللهجة اليمنية أو العربية المناسبة، وأجب على سؤاله أو اطلب منه التوضيح إذا لزم الأمر: "${messageText}"`,
        });

        const replyText = response.text;
        await sock.sendMessage(remoteJid, { text: replyText }, { quoted: msg });
        console.log(`✅ تم إرسال الرد الذكي بنجاح.`);
      } catch (error) {
        console.error('خطأ في توليد الرد بالذكاء الاصطناعي:', error);
        await sock.sendMessage(remoteJid, { text: 'هلا والله، مهند مشغول شوي وبيرد عليك اول ما يفضى.' }, { quoted: msg });
      }
      return;
    }

    const THREE_HOURS = 3 * 60 * 60 * 1000;
    const lastTime = lastReplied.get(remoteJid) || 0;

    if (now - lastTime > THREE_HOURS) {
      console.log(`-> إرسال رد تلقائي عام`);
      const defaultReply = "أهلاً بك، مهند غير متوفر حالياً وسيراسلك فور تفرغه.";
      await sock.sendMessage(remoteJid, { text: defaultReply }, { quoted: msg });
      lastReplied.set(remoteJid, now);
    }
  });
}

startBot();
