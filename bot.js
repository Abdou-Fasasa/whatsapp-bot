const { makeWASocket, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const fs = require("fs");
const warnings = {}; // تخزين عدد تحذيرات كل عضو
const groupLink = "https://chat.whatsapp.com/F9vTZQnqGOf1yCzUJZHiM0"; // رابط الجروب الخاص بنا
const adminContactLink = "https://wa.me/201029392297"; // رابط تواصل الأدمن
const warningResetTime = 3 * 24 * 60 * 60 * 1000; // 3 أيام بالمللي ثانية

// إحصائيات الأعضاء
let memberStats = {}; 

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                console.log("🔄 إعادة تشغيل البوت...");
                startBot();
            }
        } else if (connection === "open") {
            console.log("✅ بوت واتساب متصل!");
        }
    });

    // ✅ **الترحيب بالأعضاء الجدد عند إضافتهم**
    sock.ev.on("group-participants.update", async (update) => {
        const { id, participants, action } = update;

        if (action === "add") {
            for (const participant of participants) {
                const welcomeMsg = `✨ *مرحبًا بك في الجروب، <@${participant.split('@')[0]}>!* ✨\n\n🤖 *أنا Toby، المشرف الآلي للجروب.*\n📌 *مهمتي:* تنظيم الجروب، منع الكلام غير اللائق، وحذف أي روابط خارجية.\n\n📜 *هذا الجروب مخصص لـ:*\n- نشر ملخصات المحاضرات الأسبوعية.\n- مراجعات شاملة قبل الامتحانات.\n- الإجابة على استفسارات الطلاب.\n\n⚠️ *القوانين:*\n1️⃣ ممنوع الكلام غير اللائق.\n2️⃣ ممنوع نشر روابط خارجية (باستثناء الروابط المسموح بها).\n3️⃣ التفاعل مطلوب للاستفادة القصوى.\n\n🚀 *نتمنى لك تجربة مفيدة معنا!*`;
                await sock.sendMessage(id, { text: welcomeMsg, mentions: [participant] });
            }
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
if (!msg.message || !msg.key.remoteJid) return;
if (!msg.key.remoteJid.endsWith("@g.us")) return; // تجاهل أي رسالة ليست في الجروبات


        const chatId = msg.key.remoteJid;
        const sender = msg.key.participant || chatId;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        // ✅ **إحصائيات الأعضاء**
        if (text) {
            if (!memberStats[sender]) {
                memberStats[sender] = { messagesSent: 0, driveLinksSent: 0, warnings: 0, lastWarningTime: 0 };
            }

            memberStats[sender].messagesSent++;

            if (text.includes("drive.google.com")) {
                memberStats[sender].driveLinksSent++;
            }
        }

        // ✅ **قائمة الشتائم المحظورة**
        const bannedWords = [
            "كلمة1", "كلمة2", "كلمة3", "يا ابن", "يلعن", "كسم", "خول", "عرص", "متناك", "قحبة", "شرموط","كسمك",
            "الوسخة", "الزانية", "زب", "العرص", "الحمار", "حيوان", "حمار", "غبي", "متخلف", "تافه", "منيك", "المنيك",
            "معرص", "منيوك", "شرموطة", "وسخة", "زانية", "كحبة","قحبه","قحبة", "الواطي", "حقير", "ديوث", "النذل", "النجس", 
            "نجس", "مخنث", "قذر", "زبالة", "متوسخ", "عاهر", "نجس", "ملعون", "قذر", "فاجر", "كلب",
            "ابن الكلب", "خنزير", "فاسق", "تيس", "حمار أهلك", "عديم الشرف", "واطي", "ديوث", "عاهره", "سافلة", "مخنث",
            "متسخ", "قذر", "متنجس", "أنجس خلق الله", "عديم الرجولة", "ممسوخ", "تافهة", "حيوانة", "بهيمة", "زاني", "مخادع", "حماااار", "احاااا", "احااا", "احاا", "احا", "اح", "خولات", "وسخ", "زبالة", "متناكين", "معرصين",
            "مخانيث", "أبوك", "أمك", "أختك", "فاكر نفسك مين", "مسخرة", "حقير", "غبي", "زفت", "زانية", "خرا", "قرف", "جربوع", "عرصات", "بنت الوسخة", "ابن القحبة", "سفلة", "كخة", "خنيث", "هلفوت", "دلدول", "مقرف",
            "خنزير", "ملعون أبوك", "يلعن أبوك", "يلعن شرفك", "حيوان غبي", "انت ايه"
        ];
        
        

        // ✅ **حذف الشتائم وتحذير العضو**
        if (text && bannedWords.some(word => text.toLowerCase().includes(word))) {
            const now = Date.now();
            warnings[sender] = (warnings[sender] || 0) + 1;
            memberStats[sender].lastWarningTime = now; // تخزين الوقت الحالي

            if (warnings[sender] >= 5) {
                await sock.sendMessage(chatId, { text: `🚨 *تم طرد <@${sender.split('@')[0]}> بسبب تكرار المخالفات!*`, mentions: [sender] });
                await sock.groupParticipantsUpdate(chatId, [sender], "remove");
            } else {
                await sock.sendMessage(chatId, {
                    text: `🚫 *تحذير (${warnings[sender]}/5):* الكلام غير اللائق ممنوع!\n⚠️ سيتم طردك إذا كررت ذلك. <@${sender.split('@')[0]}>`,
                    quoted: msg,
                    mentions: [sender]
                });
            }
            await sock.sendMessage(chatId, { delete: msg.key });
        }

        // ✅ **حذف الروابط غير المسموح بها (يسمح فقط للبوت والمشرفين بنشر الروابط)**
        if (text && (text.includes("http") || text.includes("www."))) {
            const isAdmin = await sock.groupMetadata(chatId).then(metadata => metadata.participants.some(participant => participant.id === sender && participant.admin));
            // منع نشر أي روابط من الأعضاء غير رابط الجروب ورابط تواصل الأدمن
            if (!isAdmin && !text.includes(groupLink) && !text.includes(adminContactLink) && !text.includes("drive.google.com")) {
                await sock.sendMessage(chatId, {
                    text: `🚫 <@${sender.split('@')[0]}> لا يمكنك نشر روابط غير مسموح بها! سيتم حذف الرسالة.`,
                    quoted: msg,
                    mentions: [sender]
                });
                await sock.sendMessage(chatId, { delete: msg.key });
            }
        }

        // ✅ **الردود التلقائية مع الاقتباس**
        if (text) {
            if (text.toLowerCase().includes("السلام عليكم")) {
                await sock.sendMessage(chatId, { text: "وعليكم السلام ورحمة الله وبركاته! 😊", quoted: msg });
            } else if (text.toLowerCase().includes("مرحبا") || text.toLowerCase().includes("مرحبًا")) {
                await sock.sendMessage(chatId, { text: "أهلاً وسهلاً! كيف يمكنني مساعدتك؟ 😊", quoted: msg });
            } else if (text.toLowerCase().includes("كيف حالك")) {
                await sock.sendMessage(chatId, { text: "أنا بخير، الحمد لله! وأنت؟ 😊", quoted: msg });
            } else if (text.toLowerCase().includes("شكرا") || text.toLowerCase().includes("شكرًا")) {
                await sock.sendMessage(chatId, { text: "على الرحب والسعة! لا شكر على واجب. 😊", quoted: msg });
            } else if (text.toLowerCase().includes("تصبح على خير")) {
                await sock.sendMessage(chatId, { text: "وأنت من أهل الخير! 🌙✨", quoted: msg });
            } else if (text.toLowerCase().includes("صباح الخير")) {
                await sock.sendMessage(chatId, { text: "صباح النور والسرور! ☀️😊", quoted: msg });
            } else if (text.toLowerCase().includes("مساء الخير")) {
                await sock.sendMessage(chatId, { text: "مساء النور والبركة! 🌙😊", quoted: msg });
            } else if (text.toLowerCase().includes("احبك")) {
                await sock.sendMessage(chatId, { text: "وأنا أحبك في الله! 💙😊", quoted: msg });
            } else if (text.toLowerCase().includes("ممكن سؤال")) {
                await sock.sendMessage(chatId, { text: "بالطبع! اسأل وأنا هنا للمساعدة. 😊", quoted: msg });
            } else if (text.toLowerCase().includes("ما اسمك")) {
                await sock.sendMessage(chatId, { text: "أنا مجرد بوت هنا لخدمتك! 😊", quoted: msg });
            } else if (text.toLowerCase().includes("وينك") || text.toLowerCase().includes("فينك")) {
                await sock.sendMessage(chatId, { text: "أنا هنا دائمًا في خدمتك! 😃", quoted: msg });
            } else if (text.toLowerCase().startsWith("/start")) {
                await sock.sendMessage(chatId, { text: "🚀 *بوت الجروب جاهز!*\n\nاكتب /help لمعرفة الأوامر المتاحة.", quoted: msg });
            } else if (text.toLowerCase().startsWith("/rules")) {
                await sock.sendMessage(chatId, { text: "📜 *قوانين الجروب:*\n1️⃣ ممنوع الكلام غير اللائق.\n2️⃣ ممنوع نشر روابط غير المسموح بها.\n3️⃣ التفاعل مطلوب للاستفادة.", quoted: msg });
            } else if (text.toLowerCase().startsWith("/contact")) {
                await sock.sendMessage(chatId, { text: `📞 للتواصل مع الأدمن: ${adminContactLink}`, quoted: msg });
            }
        }
    });

    // ✅ **إزالة التحذيرات القديمة**
    setInterval(() => {
        const now = Date.now();
        Object.keys(memberStats).forEach(member => {
            if (memberStats[member].lastWarningTime && now - memberStats[member].lastWarningTime > warningResetTime) {
                warnings[member] = 0;
                memberStats[member].warnings = 0; // إزالة التحذيرات القديمة
                console.log(`✅ تم إزالة التحذيرات للعضو <@${member.split('@')[0]}>`);
            }
        });
    }, 60 * 60 * 1000); // فحص كل ساعة

    // ✅ **فحص الملفات المرفوعة**
    sock.ev.on("message.new", async (msg) => {
        if (msg.message?.documentMessage) {
            const file = msg.message.documentMessage;
            // افترض أن هنا يتم فحص الملف لمعرفة إذا كان يحتوي على فيروس أو محتوى غير مناسب.
            // هذا المثال ليس فعّالًا في الواقع لكن يجب أن يكون هناك فحص حقيقي للملفات.
            const isSafe = true; // ستحتاج لإضافة منطق فحص حقيقي هنا.
            if (!isSafe) {
                await sock.sendMessage(msg.key.remoteJid, { text: "⚠️ تم إزالة الملف لأنه يحتوي على محتوى غير آمن." });
                await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
            }
        }
    });
}

startBot();
