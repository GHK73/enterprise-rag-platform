ALTER TABLE "QueryHistory"
    DROP COLUMN "sources",
    DROP COLUMN "evidence",
    DROP COLUMN "usedLLM",
    DROP COLUMN "outputGuardPassed";

CREATE INDEX "QueryHistory_organizationId_userId_createdAt_idx"
    ON "QueryHistory"("organizationId", "userId", "createdAt");
