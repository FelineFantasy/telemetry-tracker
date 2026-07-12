"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  removeAvatarAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/app/dashboard/actions";
import {
  SettingsPageBody,
  SettingsPageHeader,
} from "@/app/components/dashboard/settings/SettingsPageHeader";
import {
  Field,
  FieldGroup,
  Section,
  SettingsAvatar,
  SettingsBtn,
  SettingsInput,
  SettingsPill,
} from "@/app/components/dashboard/settings/settings-ui";
import type { DashboardUser } from "@/lib/dashboard-user";

export function ProfileSettingsClient({ user }: { user: DashboardUser }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [avatarPending, startAvatarTransition] = useTransition();
  const [savedDisplayName, setSavedDisplayName] = useState(user.displayName ?? "");
  const [displayName, setDisplayName] = useState(savedDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const dirty = useMemo(
    () => displayName.trim() !== savedDisplayName.trim(),
    [displayName, savedDisplayName]
  );

  function discard() {
    setDisplayName(savedDisplayName);
  }

  function save() {
    startTransition(async () => {
      const result = await updateProfileAction(displayName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const next = result.displayName ?? "";
      setSavedDisplayName(next);
      setDisplayName(next);
      toast.success("Profile updated");
      router.refresh();
    });
  }

  const avatarName = displayName.trim() || user.email;
  const avatarBusy = pending || avatarPending;

  function onAvatarSelected(file: File | undefined) {
    if (!file) return;
    startAvatarTransition(async () => {
      const formData = new FormData();
      formData.set("avatar", file);
      const result = await uploadAvatarAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAvatarUrl(result.avatarUrl);
      toast.success("Avatar updated");
      router.refresh();
    });
  }

  function removeAvatar() {
    startAvatarTransition(async () => {
      const result = await removeAvatarAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAvatarUrl(null);
      toast.success("Avatar removed");
      router.refresh();
    });
  }

  return (
    <>
      <SettingsPageHeader
        title="Profile"
        description="How you appear across Telemetry Tracker. Your display name is visible to other members of your organization."
        actions={
          <>
            <SettingsBtn variant="ghost" disabled={!dirty || pending} onClick={discard}>
              Discard
            </SettingsBtn>
            <SettingsBtn variant="primary" disabled={!dirty || pending} onClick={save}>
              {pending ? "Saving…" : "Save changes"}
            </SettingsBtn>
          </>
        }
      />
      <SettingsPageBody>
        <Section
          title="Avatar"
          description="Upload a profile photo. JPEG, PNG, or WebP up to 512 KB and 1024×1024 px. Initials are shown when no image is set."
        >
          <div className="flex flex-wrap items-center gap-5">
            <SettingsAvatar name={avatarName} src={avatarUrl} size={72} />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={avatarBusy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  onAvatarSelected(file);
                }}
              />
              <SettingsBtn
                variant="default"
                disabled={avatarBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarPending ? "Uploading…" : avatarUrl ? "Replace photo" : "Upload photo"}
              </SettingsBtn>
              {avatarUrl ? (
                <SettingsBtn variant="ghost" disabled={avatarBusy} onClick={removeAvatar}>
                  Remove
                </SettingsBtn>
              ) : null}
            </div>
          </div>
        </Section>
        <Section title="Profile information">
          <FieldGroup>
            <Field label="Display name">
              <SettingsInput
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={120}
                disabled={pending}
              />
            </Field>
            <Field label="Email">
              <div className="flex items-center gap-2">
                <SettingsInput value={user.email} readOnly className="flex-1" />
                <SettingsPill tone="success">Verified</SettingsPill>
              </div>
            </Field>
          </FieldGroup>
        </Section>
      </SettingsPageBody>
    </>
  );
}
