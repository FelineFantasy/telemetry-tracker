-- CreateEnum
CREATE TYPE "MarketingSubscriberSource" AS ENUM ('subscribe_form', 'registration');

-- CreateTable
CREATE TABLE "MarketingSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" "MarketingSubscriberSource" NOT NULL,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "consent_at" TIMESTAMP(3) NOT NULL,
    "consent_metadata" JSONB,
    "unsubscribe_token" TEXT NOT NULL,

    CONSTRAINT "MarketingSubscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscriber_email_key" ON "MarketingSubscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscriber_unsubscribe_token_key" ON "MarketingSubscriber"("unsubscribe_token");

-- CreateIndex
CREATE INDEX "MarketingSubscriber_unsubscribed_at_idx" ON "MarketingSubscriber"("unsubscribed_at");

-- CreateIndex
CREATE INDEX "MarketingSubscriber_source_idx" ON "MarketingSubscriber"("source");
