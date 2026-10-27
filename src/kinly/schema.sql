-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'trial',
    "planStatus" TEXT NOT NULL DEFAULT 'trialing',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "trialEndsAt" DATETIME,
    "billingProvider" TEXT,
    "billingCustomerId" TEXT,
    "billingSubscriptionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "family_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "relation" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_members_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "relation" TEXT NOT NULL DEFAULT '',
    "token" TEXT NOT NULL,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "elders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preferredName" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT NOT NULL DEFAULT '',
    "languages" TEXT NOT NULL DEFAULT 'en',
    "phone" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "city" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "screenToken" TEXT NOT NULL,
    "consentStatus" TEXT NOT NULL DEFAULT 'pending',
    "consentAt" DATETIME,
    "consentChannel" TEXT,
    "consentTranscript" TEXT,
    "emergencyNumber" TEXT NOT NULL DEFAULT '112',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "lastActiveAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "elders_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "call_schedules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "timeLocal" TEXT NOT NULL,
    "days" TEXT NOT NULL DEFAULT 'daily',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "call_schedules_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medicines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL DEFAULT '',
    "instructions" TEXT NOT NULL DEFAULT '',
    "times" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medicines_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "medicine_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "scheduledFor" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedAt" DATETIME,
    "source" TEXT,
    "remindedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medicine_logs_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "medicine_logs_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "medicines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "startsAt" DATETIME NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "remindedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "appointments_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "photoUrl" TEXT NOT NULL DEFAULT '',
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "contacts_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalId" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "languagesUsed" TEXT NOT NULL DEFAULT '',
    "transcript" TEXT NOT NULL DEFAULT '[]',
    "summary" TEXT NOT NULL DEFAULT '',
    "mood" INTEGER,
    "moodLabel" TEXT NOT NULL DEFAULT '',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "turnCount" INTEGER NOT NULL DEFAULT 0,
    "avgFirstAudioMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "conversations_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "importance" INTEGER NOT NULL DEFAULT 2,
    "conversationId" TEXT,
    "forgotten" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memories_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "quote" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "conversationId" TEXT,
    "notifiedAt" DATETIME,
    "acknowledgedAt" DATETIME,
    "acknowledgedBy" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alerts_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "mood" INTEGER,
    "moodLabel" TEXT NOT NULL DEFAULT '',
    "topics" TEXT NOT NULL DEFAULT '[]',
    "medsTaken" INTEGER NOT NULL DEFAULT 0,
    "medsMissed" INTEGER NOT NULL DEFAULT 0,
    "followUps" TEXT NOT NULL DEFAULT '[]',
    "talkAbout" TEXT NOT NULL DEFAULT '[]',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "daily_summaries_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "voice_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "fromUserId" TEXT,
    "audioPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'audio/webm',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "transcript" TEXT NOT NULL DEFAULT '',
    "playedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_messages_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "video_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "roomName" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "contactId" TEXT,
    "contactName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ringing',
    "answeredAt" DATETIME,
    "endedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "video_calls_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "call_signals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "callId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "call_signals_callId_fkey" FOREIGN KEY ("callId") REFERENCES "video_calls" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "memory_book_chapters" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "era" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "sources" TEXT NOT NULL DEFAULT '[]',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memory_book_chapters_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "phone_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'checkin',
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduledFor" DATETIME NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "executionId" TEXT,
    "conversationId" TEXT,
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "phone_calls_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_avatars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT '',
    "photoPath" TEXT NOT NULL DEFAULT '',
    "consentAudioPath" TEXT NOT NULL DEFAULT '',
    "consentTranscript" TEXT NOT NULL DEFAULT '',
    "consentAt" DATETIME,
    "adultConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "ownerApprovedAt" DATETIME,
    "ownerUserId" TEXT,
    "elderInformedAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "voiceProvider" TEXT NOT NULL DEFAULT '',
    "voiceId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    CONSTRAINT "family_avatars_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "elderId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT '',
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyId" TEXT NOT NULL,
    "elderId" TEXT,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "turn_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "elderId" TEXT,
    "channel" TEXT NOT NULL,
    "firstAudioMs" INTEGER NOT NULL,
    "asrProvider" TEXT NOT NULL DEFAULT '',
    "ttsProvider" TEXT NOT NULL DEFAULT '',
    "language" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "turn_metrics_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_familyId_userId_key" ON "family_members"("familyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "elders_screenToken_key" ON "elders"("screenToken");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_logs_medicineId_scheduledFor_key" ON "medicine_logs"("medicineId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_externalId_key" ON "conversations"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_elderId_date_key" ON "daily_summaries"("elderId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "video_calls_roomName_key" ON "video_calls"("roomName");

-- CreateIndex
CREATE UNIQUE INDEX "phone_calls_executionId_key" ON "phone_calls"("executionId");

