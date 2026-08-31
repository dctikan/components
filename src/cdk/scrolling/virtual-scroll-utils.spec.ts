import {ListRange} from '@angular/cdk/collections';
import {expandRenderedRange, VirtualScrollRenderedRange} from './virtual-scroll-utils';

describe('expandRenderedRange', () => {
  function emptyEnvelope(): VirtualScrollRenderedRange {
    return {start: null, end: null};
  }

  it('initializes a null envelope from the candidate and returns a fresh ListRange', () => {
    const historicalEnvelope = emptyEnvelope();
    const candidateRange: ListRange = {start: 4, end: 9};

    const finalRange = expandRenderedRange(historicalEnvelope, candidateRange);

    expect(historicalEnvelope).toEqual({start: 4, end: 9});
    expect(finalRange).toEqual({start: 4, end: 9});
    expect(finalRange).not.toBe(candidateRange);
    expect(finalRange).not.toBe(historicalEnvelope as unknown as ListRange);
  });

  it('does not shrink when the candidate is contained by the envelope', () => {
    const historicalEnvelope: VirtualScrollRenderedRange = {start: 0, end: 9};
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 4, end: 7});

    expect(historicalEnvelope).toEqual({start: 0, end: 9});
    expect(finalRange).toEqual({start: 0, end: 9});
  });

  it('expands the lower bound when the candidate starts earlier', () => {
    const historicalEnvelope: VirtualScrollRenderedRange = {start: 4, end: 9};
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 1, end: 9});

    expect(historicalEnvelope).toEqual({start: 1, end: 9});
    expect(finalRange).toEqual({start: 1, end: 9});
  });

  it('expands the upper bound when the candidate ends later', () => {
    const historicalEnvelope: VirtualScrollRenderedRange = {start: 0, end: 4};
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 0, end: 9});

    expect(historicalEnvelope).toEqual({start: 0, end: 9});
    expect(finalRange).toEqual({start: 0, end: 9});
  });

  it('expands both bounds when the candidate is wider', () => {
    const historicalEnvelope: VirtualScrollRenderedRange = {start: 4, end: 9};
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 1, end: 12});

    expect(historicalEnvelope).toEqual({start: 1, end: 12});
    expect(finalRange).toEqual({start: 1, end: 12});
  });

  it('fills the gap between disjoint candidates into one contiguous envelope', () => {
    const historicalEnvelope: VirtualScrollRenderedRange = {start: 10, end: 20};
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 30, end: 40});

    expect(historicalEnvelope).toEqual({start: 10, end: 40});
    expect(finalRange).toEqual({start: 10, end: 40});
  });

  it('fills the gap when the candidate is entirely before the envelope', () => {
    const historicalEnvelope: VirtualScrollRenderedRange = {start: 30, end: 40};
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 10, end: 20});

    expect(historicalEnvelope).toEqual({start: 10, end: 40});
    expect(finalRange).toEqual({start: 10, end: 40});
  });

  it('keeps the historical envelope across successive expanding and contained candidates', () => {
    const historicalEnvelope = emptyEnvelope();

    expandRenderedRange(historicalEnvelope, {start: 10, end: 20});
    expandRenderedRange(historicalEnvelope, {start: 30, end: 40});
    const finalRange = expandRenderedRange(historicalEnvelope, {start: 15, end: 18});

    expect(historicalEnvelope).toEqual({start: 10, end: 40});
    expect(finalRange).toEqual({start: 10, end: 40});
  });
});
