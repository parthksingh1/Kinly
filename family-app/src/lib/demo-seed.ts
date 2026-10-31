import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

/**
 * Demo family for DEMO_MODE: Kamala (74, Pune), her son Arjun (Bengaluru) and
 * granddaughter Riya (studying in Boston), with 14 days of realistic history.
 * Login: arjun@kinly.demo / kinly-demo  (Riya: riya@kinly.demo / kinly-demo)
 */

export const DEMO_PASSWORD = "kinly-demo";
export const DEMO_SCREEN_TOKEN = "kamala-demo-screen";
const IST_OFFSET_MIN = 330;

function istDate(daysAgo: number, hhmm: string, now = new Date()) {
  const [h, m] = hhmm.split(":").map(Number);
  const istNow = new Date(now.getTime() + IST_OFFSET_MIN * 60000);
  const d = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() - daysAgo, h, m));
  return new Date(d.getTime() - IST_OFFSET_MIN * 60000);
}

function istDay(daysAgo: number, now = new Date()) {
  return istDate(daysAgo, "12:00", now).toISOString().slice(0, 10);
}

type Turn = [role: "assistant" | "user", text: string, priv?: boolean];
type Day = {
  ago: number;
  time: string;
  channel: "phone" | "screen";
  lang: string;
  mood: number;
  topics: string[];
  summary: string;
  turns: Turn[];
};

const DAYS: Day[] = [
  { ago: 13, time: "10:02", channel: "phone", lang: "en", mood: 4, topics: ["Gardening", "Family"],
    summary: "Kamala was cheerful. Her roses are budding and she watered the tulsi. She asked whether Riya's exams are over.",
    turns: [["assistant", "Good morning Kamala, it's Kinly. How are you feeling today?"], ["user", "Good morning! I am fine. My roses have new buds."], ["assistant", "How lovely! Which colour are they?"], ["user", "Pink ones, the desi gulab. My husband planted that bush."], ["assistant", "Have you taken your blood pressure tablet this morning?"], ["user", "Yes, after breakfast."], ["user", "Are Riya's exams over? She must be so busy."]] },
  { ago: 12, time: "10:01", channel: "phone", lang: "hi", mood: 4, topics: ["Music", "Walks & exercise"],
    summary: "Kamala went for her morning walk and listened to Lata Mangeshkar songs. She sounded relaxed and well.",
    turns: [["assistant", "नमस्ते कमला जी, मैं Kinly बोल रही हूँ। आज आप कैसी हैं?"], ["user", "बढ़िया हूँ। सुबह पार्क में टहलने गई थी।"], ["assistant", "वाह! पार्क में कौन मिला?"], ["user", "कोई नहीं, बस मैं और मेरे गाने। लता जी का 'लग जा गले' सुना।"], ["assistant", "बहुत सुंदर गाना है। दवाई ले ली आपने?"], ["user", "हाँ, ले ली।"]] },
  { ago: 11, time: "10:03", channel: "phone", lang: "en", mood: 4, topics: ["Memories", "Food & cooking"],
    summary: "Kamala shared memories of her father's mango orchard in Nashik and talked about making aam panna.",
    turns: [["assistant", "Good morning Kamala! Did you sleep well?"], ["user", "Yes, quite well. I dreamt of Nashik."], ["assistant", "What was Nashik like when you were young?"], ["user", "When I was a girl, my father had a mango orchard. We would climb the trees all summer."], ["user", "My mother made aam panna for all the neighbours."], ["assistant", "That sounds wonderful. Do you still make aam panna?"], ["user", "Sometimes. Riya loves it."]] },
  { ago: 10, time: "10:00", channel: "phone", lang: "en", mood: 4, topics: ["Family", "Friends & neighbours"],
    summary: "A warm chat. Kamala mentioned her childhood friend Shanta, who moved to Indore. Medicines taken on time.",
    turns: [["assistant", "Hello Kamala, how are you this morning?"], ["user", "I'm good. I was thinking about Shanta today."], ["assistant", "Who is Shanta?"], ["user", "My best friend from school. We sang together at every function. She moved to Indore years ago."], ["assistant", "What did you two like to sing?"], ["user", "Old Lata songs, of course!"], ["assistant", "Have you taken your tablet today?"], ["user", "Yes, I took it."]] },
  { ago: 9, time: "19:30", channel: "screen", lang: "en", mood: 3, topics: ["Health", "Sleep"],
    summary: "Kamala was a bit tired and said her right knee was aching after climbing the terrace stairs. She forgot the evening tablet.",
    turns: [["assistant", "Good evening Kamala. How was your day?"], ["user", "Tiring. My knee is hurting after going up to the terrace."], ["assistant", "I'm sorry. Could you rest it with your leg up for a while?"], ["user", "Yes, I'll sit with my feet up."], ["assistant", "Have you taken your evening tablet?"], ["user", "Not yet, I'll take it later."]] },
  { ago: 8, time: "10:04", channel: "phone", lang: "hi", mood: 3, topics: ["Health", "Family"],
    summary: "Knee still sore but better. Kamala said she misses Arjun's visits and asked when he would come home.",
    turns: [["assistant", "नमस्ते कमला जी। आज घुटना कैसा है?"], ["user", "थोड़ा ठीक है, पर अभी भी दर्द है।"], ["assistant", "आराम कर रही हैं न?"], ["user", "हाँ। अर्जुन बहुत दिन से आया नहीं।"], ["assistant", "आप उन्हें याद कर रही हैं। क्या मैं उन्हें बता दूँ कि आप बात करना चाहती हैं?"], ["user", "हाँ, बता देना।"]] },
  { ago: 7, time: "10:00", channel: "phone", lang: "en", mood: 2, topics: ["Family", "Sleep"],
    summary: "Kamala sounded low and lonely. She didn't sleep well and said the house feels too quiet. Kinly suggested calling Arjun.",
    turns: [["assistant", "Good morning Kamala. How did you sleep?"], ["user", "Not well. The house is too quiet these days."], ["assistant", "That sounds hard. Have you been feeling lonely?"], ["user", "A little. I feel lonely in the evenings."], ["assistant", "Would you like to call Arjun or Riya today?"], ["user", "Maybe in the evening."], ["user", "Please don't worry Arjun about my sleep. Keep this between us.", true]] },
  { ago: 6, time: "18:45", channel: "screen", lang: "en", mood: 3, topics: ["Family", "Friends & neighbours"],
    summary: "Mood lifted after a video call with Riya. Kamala talked about Shanta again and wondered if she still sings.",
    turns: [["assistant", "Good evening Kamala! You talked to Riya today?"], ["user", "Yes! She showed me snow in Boston. I laughed so much."], ["assistant", "That's wonderful. What else is on your mind?"], ["user", "I wonder if Shanta still sings. I should find her number."], ["assistant", "Maybe Arjun could help you find it?"], ["user", "Good idea."]] },
  { ago: 5, time: "10:01", channel: "phone", lang: "hi", mood: 4, topics: ["Gardening", "Faith & festivals"],
    summary: "Kamala was in good spirits, planting curry leaves and preparing for evening aarti. Medicines on time.",
    turns: [["assistant", "नमस्ते कमला जी! आज क्या प्लान है?"], ["user", "आज कढ़ी पत्ता का पौधा लगाऊँगी।"], ["assistant", "वाह! आपकी छत का बगीचा तो बहुत सुंदर होगा।"], ["user", "हाँ, गुलाब, तुलसी, और अब कढ़ी पत्ता।"], ["assistant", "आपने सुबह की दवाई ले ली?"], ["user", "हाँ, ले ली।"]] },
  { ago: 4, time: "20:10", channel: "screen", lang: "en", mood: 4, topics: ["Music", "Memories"],
    summary: "Kamala told the story of singing on All India Radio in 1971. She missed her evening tablet but took it the next morning.",
    turns: [["assistant", "Good evening Kamala. Would you like to hear a song?"], ["user", "Did I ever tell you I sang on All India Radio?"], ["assistant", "No! Please tell me."], ["user", "In 1971, our college choir sang on the radio in Pune. My mother cried with joy."], ["assistant", "What a proud moment. What did you sing?"], ["user", "A bhajan. Shanta sang with me."]] },
  { ago: 3, time: "10:02", channel: "phone", lang: "en", mood: 4, topics: ["Walks & exercise", "Health"],
    summary: "Knee much better; Kamala walked in the park again. She is looking forward to her check-up with Dr. Mehta.",
    turns: [["assistant", "Good morning Kamala! How is your knee?"], ["user", "Much better. I walked two rounds in the park."], ["assistant", "That's great news. Any plans today?"], ["user", "Dr. Mehta's check-up is coming, I must remember."], ["assistant", "I'll remind you the day before."], ["user", "Thank you, beta."]] },
  { ago: 2, time: "10:00", channel: "phone", lang: "hi", mood: 5, topics: ["Family", "Food & cooking"],
    summary: "Very happy call: Arjun has planned a visit next month. Kamala is already planning to cook his favourite puran poli.",
    turns: [["assistant", "नमस्ते कमला जी, आज आवाज़ में बड़ी खुशी है!"], ["user", "अर्जुन अगले महीने आ रहा है!"], ["assistant", "कितनी अच्छी खबर है! क्या बनाएँगी उसके लिए?"], ["user", "पूरन पोली, उसका सबसे पसंदीदा।"], ["assistant", "वाह! दवाई ले ली आपने?"], ["user", "हाँ हाँ, ले ली।"]] },
  { ago: 1, time: "19:15", channel: "screen", lang: "en", mood: 4, topics: ["Friends & neighbours", "Music"],
    summary: "Kamala mentioned Shanta for the third time this week and sang a few lines of 'Lag Jaa Gale'. A gentle, happy evening.",
    turns: [["assistant", "Good evening Kamala. What made you smile today?"], ["user", "I found an old photo of me and Shanta in our school uniforms."], ["assistant", "What a treasure! How old were you?"], ["user", "Twelve, maybe. We look so serious!"], ["user", "Lag jaa gale ke phir ye haseen raat ho na ho..."], ["assistant", "Beautiful singing, Kamala."]] },
];

const MEMORIES: [kind: string, subject: string, content: string, importance: number, daysAgo: number][] = [
  ["family", "Riya", "Kamala's granddaughter Riya studies computer science in Boston", 3, 13],
  ["family", "Arjun", "Kamala's son Arjun works in software in Bengaluru", 3, 13],
  ["family", "Mohan", "Kamala's late husband Mohan planted the pink rose bush on the terrace", 3, 13],
  ["life_story", "Nashik", "When Kamala was a girl, her father had a mango orchard in Nashik and she climbed the trees all summer", 3, 11],
  ["life_story", "aam panna", "Kamala's mother made aam panna for all the neighbours every summer", 2, 11],
  ["life_story", "teaching", "Kamala taught Hindi at a girls' school in Pune for thirty years", 3, 12],
  ["life_story", "All India Radio", "In 1971 Kamala's college choir sang a bhajan on All India Radio in Pune, and her mother cried with joy", 3, 4],
  ["other", "Shanta", "Kamala's best school friend Shanta sang with her at every function and moved to Indore", 3, 10],
  ["like", "roses", "Kamala loves her terrace garden: pink roses, tulsi and now curry leaves", 2, 5],
  ["like", "Lata Mangeshkar", "Kamala loves old Lata Mangeshkar songs, especially 'Lag Jaa Gale'", 2, 12],
  ["like", "puran poli", "Kamala makes puran poli, Arjun's favourite dish", 2, 2],
  ["routine", "walk", "Every morning at 7, Kamala walks in the park near her home", 2, 12],
  ["routine", "aarti", "Every evening Kamala does aarti at her home temple", 2, 5],
  ["health", "knee", "Kamala said her right knee was aching after climbing the terrace stairs", 3, 1],
  ["event", "Dr. Mehta", "Kamala has a blood pressure check-up with Dr. Mehta this week", 2, 3],
];

const CHAPTERS = [
  { title: "Summers in the mango orchard", era: "Childhood",
    body: "Kamala grew up in Nashik, where her father kept a mango orchard. Every summer she and her cousins climbed the trees from morning until the light faded, and came home with sticky hands and scraped knees.\n\nHer mother turned the harvest into aam panna for the whole street. Decades later, Kamala still makes it, and her granddaughter Riya asks for it every time she visits." },
  { title: "A voice on the radio", era: "1970s",
    body: "In 1971, Kamala's college choir was invited to sing a bhajan on All India Radio in Pune. Her best friend Shanta stood beside her. At home, her mother listened by the radio and cried with joy.\n\nKamala and Shanta sang together at every school and college function. Shanta later moved to Indore, but the songs stayed: Kamala still sings Lata Mangeshkar's 'Lag Jaa Gale' in the evenings." },
  { title: "Thirty years of chalk and poetry", era: "Work",
    body: "For thirty years Kamala taught Hindi at a girls' school in Pune. She is proud that some of her students still send her Diwali greetings.\n\nShe married Mohan, who planted the pink rose bush that still blooms on her terrace, next to the tulsi and the new curry leaf plant she put in this month." },
];

export async function resetDemo(db: PrismaClient, opts: { elderPhone?: string; familyPhone?: string; uploadsDir: string; assetsDir: string }) {
  const now = new Date();
  // Remove the previous demo family (cascades to everything else) and demo users.
  const old = await db.elder.findMany({ where: { isDemo: true }, select: { familyId: true } });
  await db.family.deleteMany({ where: { id: { in: old.map((o) => o.familyId) } } });
  await db.user.deleteMany({ where: { email: { in: ["arjun@kinly.demo", "riya@kinly.demo"] } } });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const arjun = await db.user.create({ data: { email: "arjun@kinly.demo", name: "Arjun Sharma", passwordHash, isAdmin: true } });
  const riya = await db.user.create({ data: { email: "riya@kinly.demo", name: "Riya Sharma", passwordHash } });
  const family = await db.family.create({
    data: { name: "The Sharma family", plan: "premium", planStatus: "active", currency: "USD", billingProvider: "demo", createdAt: istDate(15, "09:00", now) },
  });
  await db.familyMember.createMany({
    data: [
      { familyId: family.id, userId: arjun.id, role: "owner", relation: "Son", phone: opts.familyPhone || "", notifyWhatsapp: true, notifyEmail: true },
      { familyId: family.id, userId: riya.id, role: "member", relation: "Granddaughter", phone: "", notifyWhatsapp: false, notifyEmail: true },
    ],
  });
  const elder = await db.elder.create({
    data: {
      familyId: family.id, name: "Kamala Sharma", preferredName: "Kamala", age: 74, gender: "female", languages: "en,hi",
      phone: opts.elderPhone || "", timezone: "Asia/Kolkata", city: "Pune",
      about: "Lives alone in Pune since her husband Mohan passed. Loves her terrace garden (roses, tulsi, curry leaves) and old Bollywood songs, especially Lata Mangeshkar. Walks in the park every morning at 7. Takes a blood pressure tablet twice a day.",
      screenToken: DEMO_SCREEN_TOKEN, consentStatus: "granted", consentAt: istDate(14, "10:03", now), consentChannel: "phone",
      consentTranscript: "Kinly: ...Is it alright with you if we talk like this?\nKamala: Haan, bilkul. Yes, that's fine.",
      emergencyNumber: "112", isDemo: true, lastActiveAt: istDate(1, "19:30", now), createdAt: istDate(15, "09:05", now),
    },
  });
  await db.contact.createMany({
    data: [
      { elderId: elder.id, userId: riya.id, name: "Riya", relation: "Granddaughter", email: riya.email },
      { elderId: elder.id, userId: arjun.id, name: "Arjun", relation: "Son", phone: opts.familyPhone || "", email: arjun.email, isEmergency: true },
      { elderId: elder.id, name: "Dr. Mehta", relation: "Doctor", phone: "" },
    ],
  });
  await db.callSchedule.create({ data: { elderId: elder.id, timeLocal: "10:00", days: "daily" } });
  const med = await db.medicine.create({ data: { elderId: elder.id, name: "Amlodipine", dosage: "5 mg", instructions: "After food", times: "09:00,21:00" } });
  await db.appointment.create({ data: { elderId: elder.id, title: "Blood pressure check-up with Dr. Mehta", location: "Mehta Clinic, Kothrud", startsAt: istDate(-3, "11:00", now) } });

  // Medicine adherence: everything taken except two evening doses.
  const missed = new Set(["9-21:00", "4-21:00"]);
  const logs = [];
  for (let ago = 13; ago >= 1; ago--) {
    for (const t of ["09:00", "21:00"]) {
      const isMissed = missed.has(`${ago}-${t}`);
      logs.push({
        elderId: elder.id, medicineId: med.id, scheduledFor: istDate(ago, t, now), status: isMissed ? "missed" : "taken",
        confirmedAt: isMissed ? null : istDate(ago, t === "09:00" ? "09:40" : "21:20", now), source: t === "09:00" ? "phone" : "screen",
        remindedCount: isMissed ? 2 : 1,
      });
    }
  }
  logs.push({ elderId: elder.id, medicineId: med.id, scheduledFor: istDate(0, "09:00", now), status: "taken", confirmedAt: istDate(0, "09:35", now), source: "screen", remindedCount: 1 });
  await db.medicineLog.createMany({ data: logs });

  // Conversations, phone call records and daily summaries
  for (const d of DAYS) {
    const started = istDate(d.ago, d.time, now);
    const transcript = d.turns.map(([role, text, priv], i) => ({ role, text, at: started.getTime() + i * 25000, private: !!priv, lang: d.lang }));
    const convo = await db.conversation.create({
      data: {
        elderId: elder.id, channel: d.channel, startedAt: started, endedAt: new Date(started.getTime() + d.turns.length * 25000 + 30000),
        durationSec: d.turns.length * 25 + 30, language: d.lang, languagesUsed: d.lang, transcript: JSON.stringify(transcript),
        summary: d.summary, mood: d.mood, moodLabel: ["", "Very low", "Low", "Okay", "Good", "Very good"][d.mood], topics: JSON.stringify(d.topics),
        processed: true, turnCount: d.turns.filter((t) => t[0] === "user").length, avgFirstAudioMs: d.channel === "phone" ? 780 : 1150,
      },
    });
    if (d.channel === "phone") {
      await db.phoneCall.create({ data: { elderId: elder.id, direction: "outbound", reason: "checkin", status: "completed", scheduledFor: istDate(d.ago, "10:00", now), attempt: 1, conversationId: convo.id, executionId: `demo-exec-${d.ago}` } });
    }
    const takenToday = logs.filter((l) => l.scheduledFor.toISOString().slice(0, 10) === started.toISOString().slice(0, 10) && l.status === "taken").length;
    await db.dailySummary.create({
      data: {
        elderId: elder.id, date: istDay(d.ago, now), summary: d.summary, mood: d.mood, moodLabel: ["", "Very low", "Low", "Okay", "Good", "Very good"][d.mood],
        topics: JSON.stringify(d.topics), medsTaken: takenToday, medsMissed: missed.has(`${d.ago}-21:00`) ? 1 : 0,
        followUps: JSON.stringify(d.mood <= 2 ? ["Felt lonely in the evenings"] : []), sentAt: istDate(d.ago, "20:00", now),
        talkAbout: JSON.stringify(d.ago <= 1 ? [
          "Kamala mentioned Shanta three times this week (her best school friend, who moved to Indore). Ask her about Shanta when you call.",
          "Conversation idea: In 1971 Kamala sang a bhajan on All India Radio. Ask her to tell you more.",
        ] : []),
      },
    });
  }
  // A missed call on day 6, with retries, that the family was told about
  await db.phoneCall.create({ data: { elderId: elder.id, direction: "outbound", reason: "checkin", status: "no-answer", scheduledFor: istDate(6, "10:00", now), attempt: 3, error: "handled: no-answer", executionId: "demo-exec-missed" } });

  for (const [kind, subject, content, importance, daysAgo] of MEMORIES) {
    await db.memory.create({ data: { elderId: elder.id, kind, subject, content, importance, createdAt: istDate(daysAgo, "10:10", now) } });
  }
  await db.memory.create({ data: { elderId: elder.id, kind: "health", subject: "sleep", content: "Kamala has not been sleeping well and asked Kinly not to worry Arjun", private: true, createdAt: istDate(7, "10:10", now) } });
  for (const [i, ch] of CHAPTERS.entries()) {
    await db.memoryBookChapter.create({ data: { elderId: elder.id, ...ch, createdAt: istDate(8 - i * 3, "21:00", now) } });
  }

  // One resolved, non-urgent alert from the low-mood days
  await db.alert.create({
    data: {
      elderId: elder.id, severity: "concerning", category: "loneliness", title: "Feeling lonely",
      detail: "Kamala said the house feels too quiet and she feels lonely in the evenings.", quote: "I feel lonely in the evenings.",
      status: "resolved", createdAt: istDate(7, "10:06", now), notifiedAt: istDate(7, "10:06", now),
      acknowledgedAt: istDate(7, "12:30", now), acknowledgedBy: "Arjun Sharma", resolvedAt: istDate(6, "19:00", now),
    },
  });

  // A voice message from Riya, waiting to be played on Kamala's screen
  try {
    const src = path.join(opts.assetsDir, "riya-message.mp3");
    const rel = "demo/riya-message.mp3";
    await fs.mkdir(path.join(opts.uploadsDir, "demo"), { recursive: true });
    await fs.copyFile(src, path.join(opts.uploadsDir, rel));
    await db.voiceMessage.create({
      data: { elderId: elder.id, direction: "to_elder", fromName: "Riya", fromUserId: riya.id, audioPath: rel, mimeType: "audio/mpeg", durationSec: 9,
              transcript: "Hi Nani! It's Riya. I just finished my exam and I thought of your roses. I'll call you on Sunday. Love you!", createdAt: istDate(0, "07:15", now) },
    });
  } catch (e) {
    console.warn("Demo voice message asset missing:", (e as Error).message);
  }

  await db.notification.createMany({
    data: [
      { familyId: family.id, elderId: elder.id, channel: "whatsapp", recipient: opts.familyPhone || "+91 •••• ••••", subject: "Check in: Feeling lonely (Kamala)", body: "Kamala said the house feels too quiet and she feels lonely in the evenings.", status: "logged", provider: "none", createdAt: istDate(7, "10:06", now) },
      { familyId: family.id, elderId: elder.id, channel: "email", recipient: arjun.email, subject: "Kamala's phone call with Kinly", body: DAYS[DAYS.length - 2].summary, status: "logged", provider: "none", createdAt: istDate(2, "10:08", now) },
    ],
  });
  await db.auditLog.createMany({
    data: [
      { familyId: family.id, elderId: elder.id, action: "elder_consent_granted", detail: JSON.stringify({ channel: "phone" }), createdAt: istDate(14, "10:03", now) },
      { familyId: family.id, actorUserId: arjun.id, action: "plan_activated", detail: JSON.stringify({ plan: "premium", provider: "demo" }), createdAt: istDate(15, "09:10", now) },
    ],
  });
  return { family, elder, arjun, riya };
}
