-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "PatternSession" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "patternType" TEXT NOT NULL,
    "patternVersion" TEXT NOT NULL,
    "candleData" JSONB,
    "createdById" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionShare" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternDetection" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "candleIndex" INTEGER NOT NULL,
    "candleTime" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "detectionType" TEXT NOT NULL,
    "structure" TEXT,
    "confidence" DOUBLE PRECISION,
    "metadata" JSONB,
    "canvasX" DOUBLE PRECISION,
    "canvasY" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatternDetection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternCorrection" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "detectionId" TEXT,
    "userId" TEXT NOT NULL,
    "correctionType" TEXT NOT NULL,
    "originalIndex" INTEGER,
    "originalTime" TIMESTAMP(3),
    "originalPrice" DOUBLE PRECISION,
    "originalType" TEXT,
    "correctedIndex" INTEGER,
    "correctedTime" TIMESTAMP(3),
    "correctedPrice" DOUBLE PRECISION,
    "correctedType" TEXT,
    "correctedStructure" TEXT,
    "reason" TEXT NOT NULL,
    "attachments" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "detectionId" TEXT,
    "correctionId" TEXT,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "canvasX" DOUBLE PRECISION,
    "canvasY" DOUBLE PRECISION,
    "candleTime" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "editedAt" TIMESTAMP(3),
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "originalContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "payload" JSONB NOT NULL,
    "canvasSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatternEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "PatternSession_createdById_status_idx" ON "PatternSession"("createdById", "status");

-- CreateIndex
CREATE INDEX "PatternSession_patternType_status_idx" ON "PatternSession"("patternType", "status");

-- CreateIndex
CREATE INDEX "PatternSession_createdAt_idx" ON "PatternSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionShare_sessionId_userId_key" ON "SessionShare"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "PatternDetection_sessionId_detectionType_idx" ON "PatternDetection"("sessionId", "detectionType");

-- CreateIndex
CREATE INDEX "PatternDetection_sessionId_status_idx" ON "PatternDetection"("sessionId", "status");

-- CreateIndex
CREATE INDEX "PatternDetection_candleTime_idx" ON "PatternDetection"("candleTime");

-- CreateIndex
CREATE INDEX "PatternCorrection_sessionId_status_idx" ON "PatternCorrection"("sessionId", "status");

-- CreateIndex
CREATE INDEX "PatternCorrection_userId_idx" ON "PatternCorrection"("userId");

-- CreateIndex
CREATE INDEX "PatternCorrection_detectionId_idx" ON "PatternCorrection"("detectionId");

-- CreateIndex
CREATE INDEX "PatternCorrection_createdAt_idx" ON "PatternCorrection"("createdAt");

-- CreateIndex
CREATE INDEX "PatternComment_sessionId_idx" ON "PatternComment"("sessionId");

-- CreateIndex
CREATE INDEX "PatternComment_detectionId_idx" ON "PatternComment"("detectionId");

-- CreateIndex
CREATE INDEX "PatternComment_correctionId_idx" ON "PatternComment"("correctionId");

-- CreateIndex
CREATE INDEX "PatternComment_parentId_idx" ON "PatternComment"("parentId");

-- CreateIndex
CREATE INDEX "PatternComment_userId_idx" ON "PatternComment"("userId");

-- CreateIndex
CREATE INDEX "PatternComment_createdAt_idx" ON "PatternComment"("createdAt");

-- CreateIndex
CREATE INDEX "PatternEvent_sessionId_createdAt_idx" ON "PatternEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "PatternEvent_entityId_idx" ON "PatternEvent"("entityId");

-- CreateIndex
CREATE INDEX "PatternEvent_eventType_idx" ON "PatternEvent"("eventType");

-- CreateIndex
CREATE INDEX "PatternEvent_userId_createdAt_idx" ON "PatternEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternSession" ADD CONSTRAINT "PatternSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionShare" ADD CONSTRAINT "SessionShare_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatternSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionShare" ADD CONSTRAINT "SessionShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternDetection" ADD CONSTRAINT "PatternDetection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatternSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternCorrection" ADD CONSTRAINT "PatternCorrection_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatternSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternCorrection" ADD CONSTRAINT "PatternCorrection_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "PatternDetection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternCorrection" ADD CONSTRAINT "PatternCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternComment" ADD CONSTRAINT "PatternComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatternSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternComment" ADD CONSTRAINT "PatternComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternComment" ADD CONSTRAINT "PatternComment_detectionId_fkey" FOREIGN KEY ("detectionId") REFERENCES "PatternDetection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternComment" ADD CONSTRAINT "PatternComment_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "PatternCorrection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternComment" ADD CONSTRAINT "PatternComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PatternComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternEvent" ADD CONSTRAINT "PatternEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PatternSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternEvent" ADD CONSTRAINT "PatternEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
