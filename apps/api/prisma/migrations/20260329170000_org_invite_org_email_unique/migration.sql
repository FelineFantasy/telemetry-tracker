-- One pending invite per organization + email (atomic upsert; prevents duplicate rows under concurrency).
DELETE FROM "OrganizationInvite" a
  USING "OrganizationInvite" b
WHERE a.id > b.id
  AND a.organization_id = b.organization_id
  AND LOWER(a.email) = LOWER(b.email);

CREATE UNIQUE INDEX "OrganizationInvite_organization_id_email_key" ON "OrganizationInvite"("organization_id", "email");
