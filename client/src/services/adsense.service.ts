const ADSTERRA_SCRIPT = 'https://pl29470019.effectivecpmnetwork.com/92/35/42/923542f2e6fdab0e0242c90fbb497d5a.js';
const REWARD_WAIT_MS = 15_000;

let _adInFlight = false;
let _scriptLoaded = false;

function loadScript(): Promise<void> {
  if (_scriptLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = ADSTERRA_SCRIPT;
    s.async = true;
    s.onload = () => { _scriptLoaded = true; resolve(); };
    s.onerror = () => reject(new Error('Adsterra script failed to load'));
    document.head.appendChild(s);
  });
}

export function showRewardedAd(): Promise<boolean> {
  if (_adInFlight) return Promise.resolve(false);
  _adInFlight = true;

  return loadScript()
    .then(() => new Promise<boolean>((resolve) => {
      setTimeout(() => {
        _adInFlight = false;
        resolve(true);
      }, REWARD_WAIT_MS);
    }))
    .catch(() => {
      _adInFlight = false;
      return false;
    });
}
