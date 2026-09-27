import { useAuth } from "@workos-inc/authkit-react";
import { Avatar, AvatarFallback, AvatarImage } from "@yaklabs/ui/components/avatar";
import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { env } from "../env";
import type { ChromeChoice, ChromeStyle } from "../chrome";
import type { ThemeChoice, ThemePreference } from "../theme";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

const CHROMES: { value: ChromeStyle; label: string }[] = [
  { value: "solid", label: "Solid" },
  { value: "painting", label: "Painting" },
];

// "Ethan Arnold" → "EA"; an email alone gives its first letter.
function initialsOf(names: (string | null)[], email: string): string {
  const letters = names.map((name) => name?.charAt(0) ?? "").join("");
  return (letters === "" ? email.charAt(0) : letters).toUpperCase();
}

// The title bar's flat green or its painting (ADR-115), while Ethan chooses between them.
function ChromeChoices({ chrome }: { chrome: ChromeChoice }) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Title bar</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={chrome.style}
        onValueChange={(value) => {
          const chosen = CHROMES.find((each) => each.value === value);
          if (chosen) chrome.choose(chosen.value);
        }}
      >
        {CHROMES.map(({ value, label }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

// The light, dark or system look (ADR-090), which every account menu carries.
function ThemeChoices({ theme }: { theme: ThemeChoice }) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Theme</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={theme.preference}
        onValueChange={(value) => {
          const chosen = THEMES.find((each) => each.value === value);
          if (chosen) theme.choose(chosen.value);
        }}
      >
        {THEMES.map(({ value, label }) => (
          <DropdownMenuRadioItem key={value} value={value}>
            {label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

// The avatar in the title bar's corner, and the menu it opens.
function AccountMenu({ face, children }: { face: ReactNode; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account" />
        }
      >
        {/* The ring darkens in either theme, as the bar does not change; a blend is also what
            keeps the page's text on greyscale smoothing, as it has always been (ADR-110). */}
        <Avatar size="sm" className="dark:after:mix-blend-darken">
          {face}
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Signed in with WorkOS (ADR-084): the picture or initials, the email, and the way out.
function WorkOsAccount({ theme, chrome }: { theme: ThemeChoice; chrome: ChromeChoice }) {
  const { user, signOut } = useAuth();
  if (user === null) return null;
  const face = (
    <>
      {user.profilePictureUrl !== null && <AvatarImage src={user.profilePictureUrl} alt="" />}
      <AvatarFallback>{initialsOf([user.firstName, user.lastName], user.email)}</AvatarFallback>
    </>
  );
  return (
    <AccountMenu face={face}>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-soft-ink">{user.email}</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            signOut();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <ThemeChoices theme={theme} />
      <DropdownMenuSeparator />
      <ChromeChoices chrome={chrome} />
    </AccountMenu>
  );
}

// A build without sign-in: Kay's face, the one person who is always there (ADR-114), and a
// menu that says sign-in is off. A signed-in account keeps its own face.
function LocalAccount({ theme, chrome }: { theme: ThemeChoice; chrome: ChromeChoice }) {
  const face = (
    <>
      <AvatarImage src="/kay/kay-face.webp" alt="" />
      <AvatarFallback>
        <UserRound className="size-3.5" />
      </AvatarFallback>
    </>
  );
  return (
    <AccountMenu face={face}>
      <DropdownMenuGroup>
        <DropdownMenuLabel className="text-soft-ink">
          Sign-in is off in this build
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <ThemeChoices theme={theme} />
      <DropdownMenuSeparator />
      <ChromeChoices chrome={chrome} />
    </AccountMenu>
  );
}

/**
 * The account in the title bar's corner, with the theme and the bar's look; WorkOS's user when
 * the build signs in.
 */
export const Account = env.auth.kind === "workos" ? WorkOsAccount : LocalAccount;
