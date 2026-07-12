-- Optional profile avatar (object key in R2, served via GET /api/auth/avatars/:userId).
ALTER TABLE "User" ADD COLUMN "avatar_key" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar_content_type" TEXT;
ALTER TABLE "User" ADD COLUMN "avatar_updated_at" TIMESTAMP(3);
