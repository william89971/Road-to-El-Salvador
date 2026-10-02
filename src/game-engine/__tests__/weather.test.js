import { describe, it, expect } from 'vitest';
import { calendarLabel, weatherFor } from '../weather.js';

describe('calendar', () => {
  it('starts on May 1 and reaches June on day 31', () => {
    expect(calendarLabel(0)).toBe('May 1');
    expect(calendarLabel(31)).toBe('Jun 1');
    expect(calendarLabel(70)).toBe('Jul 10');
  });
});

describe('weatherFor', () => {
  it('is a marine layer on a May morning in California and clear that afternoon', () => {
    expect(weatherFor('california', 0.22, 0).id).toBe('marine');
    expect(weatherFor('california', 0.55, 0).id).toBe('clear');
  });

  it('is heat at midday in Sonora in May, with no rain', () => {
    const wx = weatherFor('sonora', 0.5, 12);
    expect(wx.id).toBe('heat');
    expect(wx.rain).toBe(0);
  });

  it('storms on a Mexico City afternoon in June and stays clear that morning', () => {
    expect(weatherFor('central_mx', 0.55, 35).id).toBe('storm');
    expect(weatherFor('central_mx', 0.25, 35).id).toBe('clear');
  });

  it('storms in Guatemala in June, with less rain at night than in the afternoon', () => {
    const day = weatherFor('guatemala', 0.55, 46);
    const night = weatherFor('guatemala', 0.85, 46);
    expect(day.id).toBe('storm');
    expect(night.id).toBe('storm');
    expect(night.rain).toBeLessThan(day.rain);
  });

  it('resolves El Salvador to golden hour', () => {
    expect(weatherFor('el_salvador', 0.4, 70).id).toBe('golden');
  });
});
