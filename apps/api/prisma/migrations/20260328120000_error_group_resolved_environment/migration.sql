-- AlterTable
ALTER TABLE "ErrorGroup" ADD COLUMN     "environment" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3);
