import { changeAdminPasswordAction, updateAdminProfileAction } from '../actions';
import { requireAdminPage } from '../_lib/auth';

export default async function AdminSettingsPage() {
  const admin = await requireAdminPage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update admin profile and security credentials.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-600">
          Email: {admin.profile.email ?? admin.user.email ?? 'Unavailable'}
        </p>

        <form action={updateAdminProfileAction} className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Full name
            <input
              type="text"
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              defaultValue={admin.profile.full_name ?? ''}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Save Profile
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Change Password</h2>
        <p className="mt-1 text-sm text-slate-600">
          Password policy: minimum 8 characters, at least 1 uppercase letter, and 1 number.
        </p>

        <form action={changeAdminPasswordAction} className="mt-4 grid gap-3 md:max-w-lg">
          <label className="block text-sm font-medium text-slate-700">
            New password
            <input
              type="password"
              name="newPassword"
              required
              minLength={8}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Confirm new password
            <input
              type="password"
              name="confirmPassword"
              required
              minLength={8}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="submit"
            className="w-fit rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Update Password
          </button>
        </form>
      </section>
    </div>
  );
}
