import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import {
  getGetCurrentUserQueryKey,
  useGetCurrentUser,
  useUpdateProfile,
  useDeleteAccount,
} from '@/api/generated/bar-buddy';
import type { MeResponse } from '@/api/generated/models';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/use-auth';

function ProfileForm({ profile }: { profile: MeResponse }) {
  const [name, setName] = useState(profile.displayName ?? '');
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const update = useUpdateProfile();
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    try {
      await queryClient.cancelQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
      const result = await update.mutateAsync({
        data: { displayName: name.trim() },
      });
      if (!mounted.current) return;
      queryClient.setQueryData(getGetCurrentUserQueryKey(), result);
      setName(result.displayName ?? '');
      setSaved(true);
    } catch {
      // Preserve the entered name so the user can retry.
    }
  }

  return (
    <form onSubmit={(event) => void save(event)} className="mt-5 space-y-4">
      <label className="grid gap-2 text-sm font-medium" htmlFor="display-name">
        Your name
        <input
          id="display-name"
          autoComplete="nickname"
          maxLength={80}
          value={name}
          disabled={update.isPending}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
            update.reset();
          }}
          aria-describedby="name-help"
          className="h-11 rounded-lg border border-input bg-background px-3 text-base"
        />
      </label>
      <p id="name-help" className="text-sm text-muted-foreground">
        What should we call you? This is optional and only shown in your
        account.
      </p>
      {update.isError && (
        <p role="alert" className="text-sm text-red-700">
          Your name couldn’t be saved. Please try again.
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm">
          Profile saved.
        </p>
      )}
      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

function AccountSettings() {
  const { session, signOut, sendPasswordReset } = useAuth();
  const [pending, setPending] = useState<'logout' | 'reset'>();
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  async function action(kind: 'logout' | 'reset') {
    setPending(kind);
    setError(undefined);
    try {
      if (kind === 'logout') await signOut();
      else if (session?.email) {
        await sendPasswordReset(session.email);
        setSent(true);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setPending(undefined);
    }
  }

  return (
    <section
      aria-labelledby="settings-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="settings-heading" className="font-serif text-2xl">
        Account settings
      </h2>
      <p className="mt-4 text-sm text-muted-foreground">Signed in as</p>
      <p className="mt-1 font-medium">
        {session?.email ?? 'Your Bar Buddy account'}
      </p>
      <div className="mt-5 border-t border-border pt-5">
        <h3 className="font-medium">Password</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a secure link to your email to choose a new password.
        </p>
        <Button
          variant="outline"
          className="mt-3"
          disabled={!!pending || sent || !session?.email}
          onClick={() => void action('reset')}
        >
          {pending === 'reset'
            ? 'Sending…'
            : sent
              ? 'Reset email sent'
              : 'Send password reset email'}
        </Button>
        {sent && (
          <p role="status" className="mt-3 text-sm">
            Check your inbox for the password reset link.
          </p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-5 border-t border-border pt-5">
        <Button
          variant="outline"
          onClick={() => void action('logout')}
          disabled={!!pending}
        >
          <LogOut aria-hidden="true" />
          {pending === 'logout' ? 'Signing out…' : 'Sign out'}
        </Button>
      </div>
    </section>
  );
}

function DeleteAccountSettings() {
  const [expanded, setExpanded] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const { finishAccountDeletion } = useAuth();
  const deletion = useDeleteAccount();
  async function remove(event: FormEvent) {
    event.preventDefault();
    try {
      await deletion.mutateAsync({ data: { confirmation } });
    } catch {
      return;
    }
    await finishAccountDeletion().catch(() => undefined);
  }
  return (
    <section
      aria-labelledby="delete-heading"
      className="rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="delete-heading" className="font-serif text-2xl">
        Delete account
      </h2>
      <p className="mt-3 text-sm text-muted-foreground">
        Permanently delete your profile, inventory, favorites, and login. This
        cannot be undone.
      </p>
      {!expanded ? (
        <Button
          variant="outline"
          className="mt-4 text-red-700"
          onClick={() => setExpanded(true)}
        >
          Delete my account
        </Button>
      ) : (
        <form
          onSubmit={(event) => void remove(event)}
          className="mt-4 space-y-4"
        >
          <p className="text-sm">
            Your app data is removed immediately. Login removal may take a
            little longer if our sign-in service is unavailable. A minimal
            account record is retained to block old sessions and retry removal.
          </p>
          <label
            htmlFor="delete-confirmation"
            className="grid gap-2 text-sm font-medium"
          >
            Type DELETE to confirm
            <input
              id="delete-confirmation"
              value={confirmation}
              autoComplete="off"
              required
              pattern="DELETE"
              disabled={deletion.isPending}
              onChange={(event) => setConfirmation(event.target.value)}
              className="h-11 rounded-lg border border-input bg-background px-3 text-base"
            />
          </label>
          {deletion.isError && (
            <p role="alert" className="text-sm text-red-700">
              Account deletion couldn’t be confirmed. Please try again. If your
              session ended, sign in again to check your account.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              className="bg-red-700 text-white hover:bg-red-800"
              disabled={confirmation !== 'DELETE' || deletion.isPending}
            >
              {deletion.isPending ? 'Deleting…' : 'Permanently delete account'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={deletion.isPending}
              onClick={() => {
                setExpanded(false);
                setConfirmation('');
                deletion.reset();
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export function MorePage() {
  const { session } = useAuth();
  const profile = useGetCurrentUser({ query: { retry: false } });
  return (
    <section className="max-w-2xl space-y-6">
      <header>
        <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          More
        </p>
        <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Your account</h1>
        <p className="mt-4 text-muted-foreground">Make yourself at home.</p>
      </header>
      <section
        aria-labelledby="profile-heading"
        className="rounded-xl border border-border bg-card p-5 sm:p-6"
      >
        <h2 id="profile-heading" className="font-serif text-2xl">
          Profile
        </h2>
        {profile.isPending && (
          <p role="status" className="mt-4">
            Loading your profile…
          </p>
        )}
        {profile.isError ? (
          <div className="mt-4 space-y-3">
            <p role="alert">Your profile couldn’t be loaded.</p>
            <Button variant="outline" onClick={() => void profile.refetch()}>
              Reload profile
            </Button>
          </div>
        ) : (
          profile.data && (
            <ProfileForm key={session?.userId} profile={profile.data} />
          )
        )}
      </section>
      <AccountSettings key={session?.userId} />
      <DeleteAccountSettings key={`delete-${session?.userId}`} />
    </section>
  );
}
