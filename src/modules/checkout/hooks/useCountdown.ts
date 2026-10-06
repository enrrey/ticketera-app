import { useEffect, useState } from "react";

/**
 * Seconds left until `expiresAt`, measured against the server clock: the offset
 * between `serverTime` and the browser clock is captured once, so a wrong local
 * clock cannot extend or shorten the reservation shown to the buyer.
 */
export function useCountdown(expiresAt: string, serverTime: string) {
  const [skewMs] = useState(() => Date.parse(serverTime) - Date.now());
  const remaining = () => Math.max(0, Math.ceil((Date.parse(expiresAt) - (Date.now() + skewMs)) / 1000));
  const [seconds, setSeconds] = useState(remaining);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(remaining()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `remaining` only reads the stable inputs below.
  }, [expiresAt, skewMs]);

  return seconds;
}
