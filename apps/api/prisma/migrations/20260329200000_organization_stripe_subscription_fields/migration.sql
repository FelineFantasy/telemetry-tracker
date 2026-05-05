-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "stripe_subscription_status" TEXT,
ADD COLUMN "stripe_current_period_end" TIMESTAMP(3);
