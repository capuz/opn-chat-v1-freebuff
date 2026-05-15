const AD_CLIENT = 'ca-pub-7626774247344411'; // reemplazar con tu Publisher ID
const AD_SLOT   = '8267497706';        // reemplazar con el Slot ID del ad unit "Recompensado"

let _adInFlight = false;

export function showRewardedAd(): Promise<boolean> {
  if (_adInFlight) return Promise.resolve(false);

  return new Promise((resolve) => {
    _adInFlight = true;
    const win = window as Window & { adsbygoogle: AdsBygoogle };
    const adsbygoogle = win.adsbygoogle;

    if (!adsbygoogle || typeof adsbygoogle.push !== 'function') {
      _adInFlight = false;
      resolve(false);
      return;
    }

    let resolved = false;
    const done = (granted: boolean) => {
      if (!resolved) { resolved = true; _adInFlight = false; resolve(granted); }
    };

    try {
      adsbygoogle.push({
        params: {
          google_ad_client: AD_CLIENT,
          google_ad_slot:   AD_SLOT,
        },
        callback(result: EventTarget) {
          result.addEventListener('rewardedSlotReady', (e: Event) => {
            (e as RewardedSlotReadyEvent).makeRewardedVisible();
          });
          result.addEventListener('rewardedSlotGranted', () => done(true));
          result.addEventListener('rewardedSlotClosed',  () => done(false));
          result.addEventListener('rewardedSlotFailed',  () => done(false));
        },
      });
    } catch {
      done(false);
    }

    setTimeout(() => done(false), 30_000);
  });
}
