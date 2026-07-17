"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { renameOrganizationAction } from "@/app/dashboard/actions";
import {
  Section,
  SettingsBtn,
  SettingsInput,
} from "@/app/components/dashboard/settings/settings-ui";
import { toast } from "sonner";

export function OrganizationRenameSection({
  organizationId,
  organizationName,
  canRename,
}: {
  organizationId: string;
  organizationName: string;
  canRename: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(organizationName);

  useEffect(() => {
    setName(organizationName);
  }, [organizationId, organizationName]);

  function onSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Workspace name is required");
      return;
    }
    if (trimmed === organizationName) {
      toast.message("No changes to save");
      return;
    }
    startTransition(async () => {
      const r = await renameOrganizationAction(organizationId, trimmed);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Workspace renamed");
      router.refresh();
    });
  }

  return (
    <div id="rename-workspace" className="scroll-mt-24">
      <Section
        title="Workspace name"
        description={
          canRename
            ? "This name appears in the organization switcher and invites."
            : "Only organization owners can rename the workspace."
        }
        className="max-w-lg"
      >
        {canRename ? (
          <div className="flex flex-col gap-3">
            <label
              className="text-[13px] text-muted-foreground"
              htmlFor="workspace-name"
            >
              Name
            </label>
            <SettingsInput
              id="workspace-name"
              name="name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="organization"
              disabled={pending}
            />
            <SettingsBtn
              type="button"
              variant="primary"
              disabled={pending}
              onClick={onSave}
            >
              {pending ? "Saving…" : "Save workspace name"}
            </SettingsBtn>
          </div>
        ) : (
          <p className="m-0 text-sm font-medium text-foreground">{organizationName}</p>
        )}
      </Section>
    </div>
  );
}
