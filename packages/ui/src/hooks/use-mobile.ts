import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const isNarrow = () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(isNarrow);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(isNarrow());
    };
    mql.addEventListener("change", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile;
}
