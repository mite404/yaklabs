import { useAuth } from "@workos-inc/authkit-react";
import { Button } from "@yaklabs/ui/components/button";
import { env } from "../env";

// Who is signed in, and the way out; WorkOS clears its session and returns to the site.
function WorkOsSessionMenu() {
  const { user, signOut } = useAuth();
  if (user === null) return null;
  return (
    <div className="flex items-center gap-2 text-sm text-soft-ink">
      <span>{user.email}</span>
      <Button variant="outline" size="sm" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}

function NoSessionMenu() {
  return null;
}

/** The header's session corner: empty when the build has no sign-in. */
export const SessionMenu = env.auth.kind === "workos" ? WorkOsSessionMenu : NoSessionMenu;
