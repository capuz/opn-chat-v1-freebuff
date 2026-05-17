declare namespace googletag {
  interface CommandArray {
    push(f: () => void): void;
  }

  namespace enums {
    enum OutOfPageFormat {
      REWARDED = 4,
    }
  }

  namespace events {
    interface RewardedSlotReadyEvent {
      makeRewardedVisible(): void;
    }
    interface RewardedSlotGrantedEvent {
      payload: { amount: number; type: string } | null;
    }
    interface RewardedSlotClosedEvent {}
    interface SlotRenderEndedEvent {
      slot: Slot;
      isEmpty: boolean;
    }
  }

  interface Slot {
    addService(service: PubAdsService): Slot;
  }

  interface PubAdsService {
    addEventListener(event: 'rewardedSlotReady', handler: (e: events.RewardedSlotReadyEvent) => void): PubAdsService;
    addEventListener(event: 'rewardedSlotGranted', handler: (e: events.RewardedSlotGrantedEvent) => void): PubAdsService;
    addEventListener(event: 'rewardedSlotClosed', handler: (e: events.RewardedSlotClosedEvent) => void): PubAdsService;
    addEventListener(event: 'slotRenderEnded', handler: (e: events.SlotRenderEndedEvent) => void): PubAdsService;
    removeEventListener(event: string, handler: (e: unknown) => void): PubAdsService;
  }

  function defineOutOfPageSlot(adUnitPath: string, format: enums.OutOfPageFormat): Slot | null;
  function pubads(): PubAdsService;
  function enableServices(): void;
  function display(slot: Slot): void;
  function destroySlots(slots: Slot[]): boolean;

  const cmd: CommandArray;
}

interface Window {
  googletag: typeof googletag;
}
