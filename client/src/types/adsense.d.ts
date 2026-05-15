interface RewardedSlotReadyEvent extends Event {
  makeRewardedVisible(): void;
}

interface AdsBygoogle {
  push(params: object): void;
}

interface Window {
  adsbygoogle: AdsBygoogle | unknown[];
}
