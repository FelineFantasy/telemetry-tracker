-- CreateTable
CREATE TABLE "MarketingReleaseEmailSend" (
    "id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "release_version" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingReleaseEmailSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingReleaseEmailSend_subscriber_id_release_version_key" ON "MarketingReleaseEmailSend"("subscriber_id", "release_version");

-- CreateIndex
CREATE INDEX "MarketingReleaseEmailSend_release_version_idx" ON "MarketingReleaseEmailSend"("release_version");

-- AddForeignKey
ALTER TABLE "MarketingReleaseEmailSend" ADD CONSTRAINT "MarketingReleaseEmailSend_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "MarketingSubscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
