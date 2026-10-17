ALTER TABLE "ApiRequestMetric"
    ADD COLUMN "rawCacheOutcome" "CacheOutcome",
    ADD COLUMN "authorizedCacheOutcome" "CacheOutcome";

CREATE INDEX "ApiRequestMetric_rawCacheOutcome_idx"
    ON "ApiRequestMetric"("rawCacheOutcome");

CREATE INDEX "ApiRequestMetric_authorizedCacheOutcome_idx"
    ON "ApiRequestMetric"("authorizedCacheOutcome");
