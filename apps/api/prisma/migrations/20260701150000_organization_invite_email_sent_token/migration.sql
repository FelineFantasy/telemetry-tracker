ALTER TABLE "OrganizationInvite" ADD COLUMN "invite_email_sent_token" TEXT;

ALTER TABLE "OrganizationInvite" DROP COLUMN "invite_email_sent_at";
