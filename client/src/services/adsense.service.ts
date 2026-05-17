const REWARD_WAIT_MS = 15_000;

let _adInFlight = false;

export function showRewardedAd(): Promise<boolean> {
  if (_adInFlight) return Promise.resolve(false);
  _adInFlight = true;

  return new Promise((resolve) => {
    setTimeout(() => {
      _adInFlight = false;
      resolve(true);
    }, REWARD_WAIT_MS);
  });
}
