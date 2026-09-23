import {expandRenderedRange} from './virtual-scroll-utils';

describe('expandRenderedRange', () => {
  it('keeps the contiguous envelope between disjoint candidate ranges', () => {
    const history = {start: null as number | null, end: null as number | null};

    expect(expandRenderedRange(history, {start: 10, end: 20})).toEqual({start: 10, end: 20});
    expect(expandRenderedRange(history, {start: 30, end: 40})).toEqual({start: 10, end: 40});
    expect(expandRenderedRange(history, {start: 15, end: 18})).toEqual({start: 10, end: 40});
    expect(history).toEqual({start: 10, end: 40});
  });
});
