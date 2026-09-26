import { useAuth } from "@workos-inc/authkit-react";
import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { UserRound } from "lucide-react";
import { env } from "../env";

// Who is signed in, and the way out; WorkOS clears its session and returns to the site.
function WorkOsSessionMenu() {
  const { user, signOut } = useAuth();
  if (user === null) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Account" />}>
        <UserRound />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end">
        <DropdownMenuLabel className="font-normal text-soft-ink">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            signOut();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoSessionMenu() {
  return null;
}

/** The rail's account corner: empty when the build has no sign-in. */
export const SessionMenu = env.auth.kind === "workos" ? WorkOsSessionMenu : NoSessionMenu;
