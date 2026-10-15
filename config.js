// UBI config. Set CA and X when live. Everything on the site reads from here.
window.UBI = {
  NAME: 'ubi',
  TICKER: '$UBI',
  CA: '',                                   // the pump.fun mint, once live
  X: 'https://x.com/',                      // the payroll's X account, e.g. https://x.com/ubipayroll
  SITE: 'https://ubi-payroll.vercel.app',
  RELEASE: '2026-11-19T00:00:00-05:00',     // the new city opens
  PAYDAY_DOW: null, PAYDAY_HOUR_UTC: 18,    // payday: every day at 18:00 UTC (set a 0-6 weekday for weekly)
  FEE_PCT: 0.95,                            // creator fee share of volume used by the calculator (pump.fun tiers vary)
  CARD_USD: 99.99, CARD_GTA: 8000000,       // the card the payroll buys: official price and what it gives
  MIN_HOLD_USD: 20                          // minimum holding to be on the payroll (shown, not enforced on-chain)
};
