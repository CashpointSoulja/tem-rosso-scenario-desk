import clean from '../fixtures/clean-day.csv?raw';
import missing from '../fixtures/missing-meter-batch.csv?raw';
import resend from '../fixtures/resend-and-model-change.csv?raw';
import clock from '../fixtures/clock-change-day.csv?raw';

export const FIXTURE_TEXT: Record<string, string> = {
  'clean-day.csv': clean,
  'missing-meter-batch.csv': missing,
  'resend-and-model-change.csv': resend,
  'clock-change-day.csv': clock,
};
