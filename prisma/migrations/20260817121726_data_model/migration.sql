-- CreateEnum
CREATE TYPE "ModelResponseStatus" AS ENUM ('ANSWERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ModelCallFailureKind" AS ENUM ('unauthorized', 'rate-limited', 'unavailable', 'timeout', 'aborted', 'sign-in-required', 'blocked', 'flagged', 'unknown');

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Turn" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelResponse" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "status" "ModelResponseStatus" NOT NULL,
    "text" TEXT,
    "failureKind" "ModelCallFailureKind",
    "timeToFirstTokenMs" INTEGER,
    "generationMs" INTEGER,
    "totalMs" INTEGER,
    "deltaCount" INTEGER,
    "streamed" BOOLEAN,
    "tokensPerSecond" DOUBLE PRECISION,
    "endToEndTokensPerSecond" DOUBLE PRECISION,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "reasoningTokens" INTEGER,
    "textTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "winningResponseId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Thread_ownerId_createdAt_idx" ON "Thread"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Turn_threadId_ordinal_key" ON "Turn"("threadId", "ordinal");

-- CreateIndex
CREATE INDEX "ModelResponse_modelId_idx" ON "ModelResponse"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelResponse_turnId_modelId_key" ON "ModelResponse"("turnId", "modelId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelResponse_id_turnId_key" ON "ModelResponse"("id", "turnId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_turnId_key" ON "Vote"("turnId");

-- CreateIndex
CREATE INDEX "Vote_voterId_idx" ON "Vote"("voterId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_winningResponseId_turnId_key" ON "Vote"("winningResponseId", "turnId");

-- AddForeignKey
ALTER TABLE "Turn" ADD CONSTRAINT "Turn_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelResponse" ADD CONSTRAINT "ModelResponse_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "Turn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "Turn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_winningResponseId_turnId_fkey" FOREIGN KEY ("winningResponseId", "turnId") REFERENCES "ModelResponse"("id", "turnId") ON DELETE CASCADE ON UPDATE CASCADE;
