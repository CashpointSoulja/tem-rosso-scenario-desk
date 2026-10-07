export interface Sample {
  file: string;
  title: string;
  expect: string;
}

export const SAMPLES: Sample[] = [
  { file: 'clean-day.csv', title: 'Clean day', expect: 'All 192 slots covered, nothing to review. All three scenarios conclude.' },
  { file: 'missing-meter-batch.csv', title: 'Missing meter batch', expect: 'D-02 blank SP 34-39 and G-02 SP 12 absent. Scenarios are blocked, not zero-filled.' },
  { file: 'resend-and-model-change.csv', title: 'Resend + model change', expect: 'Conflicting resend at D-01 SP 20, stale G-02 forecasts, model switch at SP 25. Needs manual review.' },
  { file: 'clock-change-day.csv', title: 'Clock-change day', expect: '25 October 2026 has 50 settlement periods. All conclude.' },
];
