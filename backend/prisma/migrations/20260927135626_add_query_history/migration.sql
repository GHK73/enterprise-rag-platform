-- CreateTable
CREATE TABLE "QueryHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "answer" TEXT,
    "sources" JSONB,
    "evidence" JSONB,
    "usedLLM" BOOLEAN NOT NULL DEFAULT false,
    "outputGuardPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueryHistory_organizationId_idx" ON "QueryHistory"("organizationId");

-- CreateIndex
CREATE INDEX "QueryHistory_userId_idx" ON "QueryHistory"("userId");

-- CreateIndex
CREATE INDEX "QueryHistory_createdAt_idx" ON "QueryHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "QueryHistory" ADD CONSTRAINT "QueryHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryHistory" ADD CONSTRAINT "QueryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
