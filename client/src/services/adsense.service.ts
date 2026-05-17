// TODO: replace with your Google Ad Manager ad unit path (e.g. '/12345678/rewarded_unit')
const GPT_AD_UNIT = '/22639388115/rewarded_web_example';

let _adInFlight = false;

export function showRewardedAd(): Promise<boolean> {
  if (_adInFlight) return Promise.resolve(false);

  return new Promise((resolve) => {
    _adInFlight = true;
    const { googletag } = window;

    if (!googletag?.cmd) {
      _adInFlight = false;
      resolve(false);
      return;
    }

    let resolved = false;
    let rewardGranted = false;

    const done = (granted: boolean) => {
      if (!resolved) {
        resolved = true;
        _adInFlight = false;
        resolve(granted);
      }
    };

    googletag.cmd.push(() => {
      const slot = googletag.defineOutOfPageSlot(
        GPT_AD_UNIT,
        googletag.enums.OutOfPageFormat.REWARDED,
      );

      if (!slot) {
        done(false);
        return;
      }

      slot.addService(googletag.pubads());

      const onReady = (event: googletag.events.RewardedSlotReadyEvent) => {
        event.makeRewardedVisible();
      };
      const onGranted = () => {
        rewardGranted = true;
      };
      const onClosed = () => {
        cleanup(rewardGranted);
      };
      const onRenderEnded = (event: googletag.events.SlotRenderEndedEvent) => {
        if (event.slot === slot && event.isEmpty) cleanup(false);
      };

      const cleanup = (granted: boolean) => {
        googletag.pubads().removeEventListener('rewardedSlotReady', onReady as (e: unknown) => void);
        googletag.pubads().removeEventListener('rewardedSlotGranted', onGranted as (e: unknown) => void);
        googletag.pubads().removeEventListener('rewardedSlotClosed', onClosed as (e: unknown) => void);
        googletag.pubads().removeEventListener('slotRenderEnded', onRenderEnded as (e: unknown) => void);
        googletag.destroySlots([slot]);
        done(granted);
      };

      googletag.pubads().addEventListener('rewardedSlotReady', onReady);
      googletag.pubads().addEventListener('rewardedSlotGranted', onGranted);
      googletag.pubads().addEventListener('rewardedSlotClosed', onClosed);
      googletag.pubads().addEventListener('slotRenderEnded', onRenderEnded);

      googletag.enableServices();
      googletag.display(slot);
    });

    setTimeout(() => done(false), 60_000);
  });
}
