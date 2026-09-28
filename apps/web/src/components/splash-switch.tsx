import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { Paintbrush } from "lucide-react";
import { splashStyleOf, type SplashChoice, type SplashStyle } from "../splash";

const LOOKS: { value: SplashStyle; label: string }[] = [
  { value: "landscape", label: "Landscape" },
  { value: "abstract", label: "Abstract" },
  { value: "vitruvian", label: "Vitruvian" },
];
const labelOf = (style: SplashStyle): string =>
  LOOKS.find((each) => each.value === style)?.label ?? "";

/**
 * The floating debug switch at the window's bottom right that picks the empty canvas's look
 * (ADR-135): the landscape, the abstract painting or Atlas. It is here while Ethan chooses
 * between the three, and leaves with the choice. On a phone it sits above the compose box.
 */
export function SplashSwitch({ splash }: { splash: SplashChoice }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            data-slot="splash-switch"
            aria-label={`Splash look: ${labelOf(splash.style)}`}
            className="fixed right-6 bottom-6 z-50 rounded-[var(--radius)] shadow-[0_4px_16px_var(--shadow)] max-md:bottom-28"
          />
        }
      >
        <Paintbrush />
        Splash · {labelOf(splash.style)}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end">
        <DropdownMenuLabel>Empty canvas</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={splash.style}
          onValueChange={(value) => {
            const chosen = splashStyleOf(typeof value === "string" ? value : null);
            if (chosen !== null) splash.choose(chosen);
          }}
        >
          {LOOKS.map(({ value, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
