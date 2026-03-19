-- AlterTable
ALTER TABLE "ErrorOccurrence" ADD COLUMN     "anonymous_id" TEXT,
ADD COLUMN     "sdk_version" TEXT;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "anonymous_id" TEXT,
ADD COLUMN     "sdk_version" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "anonymous_id" TEXT,
ADD COLUMN     "sdk_version" TEXT;
