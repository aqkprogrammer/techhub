'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/auth-provider';

type ProfilePayload = {
  profile: {
    id: string;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    role: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  error?: string;
};

type AvatarPayload = {
  avatarUrl: string | null;
  profile: ProfilePayload['profile'];
  error?: string;
};

const MAX_AVATAR_MB = 5;
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function AccountSettingsPage() {
  const { user, profile, refreshAuth } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovingAvatar, setIsRemovingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fallbackName = useMemo(() => {
    if (profile?.fullName) return profile.fullName;
    if (user?.email) return user.email.split('@')[0];
    return 'U';
  }, [profile?.fullName, user?.email]);

  const displayedAvatarUrl = avatarPreviewUrl ?? profile?.avatarUrl ?? null;

  useEffect(() => {
    setFullName(profile?.fullName ?? '');
  }, [profile?.fullName]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const onAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setSuccess(null);

    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setAvatarFile(null);
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
      setAvatarPreviewUrl(null);
      return;
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, WEBP, and GIF images are supported.');
      event.target.value = '';
      return;
    }

    const maxBytes = MAX_AVATAR_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`Image too large. Maximum size is ${MAX_AVATAR_MB}MB.`);
      event.target.value = '';
      return;
    }

    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
    }

    setAvatarFile(file);
    setAvatarPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelectedAvatarFile = () => {
    setAvatarFile(null);
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      setAvatarPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onRemoveAvatar = async () => {
    setError(null);
    setSuccess(null);
    setIsRemovingAvatar(true);

    try {
      const response = await fetch('/api/account/avatar', {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      const payload = (await response.json()) as AvatarPayload;
      if (!response.ok) {
        setError(payload.error ?? 'Failed to remove avatar.');
        return;
      }

      clearSelectedAvatarFile();
      await refreshAuth();
      setSuccess('Avatar removed.');
    } catch {
      setError('Failed to remove avatar.');
    } finally {
      setIsRemovingAvatar(false);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);

    try {
      const updateProfileResponse = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          fullName: fullName.trim() ? fullName.trim() : null,
        }),
      });

      const updateProfilePayload = (await updateProfileResponse.json()) as ProfilePayload;
      if (!updateProfileResponse.ok) {
        setError(updateProfilePayload.error ?? 'Failed to update profile.');
        return;
      }

      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);

        const uploadResponse = await fetch('/api/account/avatar', {
          method: 'POST',
          body: formData,
          credentials: 'same-origin',
        });
        const uploadPayload = (await uploadResponse.json()) as AvatarPayload;
        if (!uploadResponse.ok) {
          setError(uploadPayload.error ?? 'Failed to upload avatar.');
          return;
        }
      }

      clearSelectedAvatarFile();
      await refreshAuth();
      setSuccess(avatarFile ? 'Profile and avatar updated successfully.' : 'Profile updated successfully.');
    } catch {
      setError('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[rgb(var(--text))]">Settings</h1>
        <p className="mt-1 text-sm text-[rgb(var(--muted))]">
          Update your public profile details used across your account.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm text-[rgb(var(--text))]">
          <span className="mb-1 block font-medium">Email</span>
          <input
            type="email"
            disabled
            value={user?.email ?? ''}
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-[rgb(var(--muted))]"
          />
        </label>

        <label className="block text-sm text-[rgb(var(--text))]">
          <span className="mb-1 block font-medium">Full name</span>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={120}
            placeholder="Your full name"
            className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-[rgb(var(--text))]"
          />
        </label>

        <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4">
          <p className="mb-2 text-sm font-medium text-[rgb(var(--text))]">Profile image</p>
          <div className="flex flex-wrap items-center gap-3">
            {displayedAvatarUrl ? (
              <img
                src={displayedAvatarUrl}
                alt="Profile avatar preview"
                className="h-14 w-14 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgb(var(--accent-soft))] text-base font-bold text-[rgb(var(--accent))]">
                {(fallbackName.trim()[0] ?? 'U').toUpperCase()}
              </span>
            )}

            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <label
                  htmlFor="avatar-file"
                  className="cursor-pointer rounded-md bg-[rgb(var(--accent-soft))] px-3 py-2 text-sm font-semibold text-[rgb(var(--accent))]"
                >
                  Choose file
                </label>
                <span className="text-xs text-[rgb(var(--muted))]">
                  {avatarFile?.name ?? 'No file selected'}
                </span>
              </div>
              <input
                id="avatar-file"
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={onAvatarFileChange}
                className="sr-only"
              />
              <p className="mt-1 text-xs text-[rgb(var(--muted))]">
                JPG, PNG, WEBP, GIF. Max {MAX_AVATAR_MB}MB.
              </p>
            </div>

            <button
              type="button"
              onClick={onRemoveAvatar}
              disabled={isRemovingAvatar || isSaving || (!profile?.avatarUrl && !avatarPreviewUrl)}
              className="rounded-lg border border-[rgb(var(--border))] px-3 py-2 text-sm font-medium text-[rgb(var(--text))] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRemovingAvatar ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

        <button
          type="submit"
          disabled={isSaving || isRemovingAvatar}
          className="rounded-lg bg-[rgb(var(--accent))] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}
