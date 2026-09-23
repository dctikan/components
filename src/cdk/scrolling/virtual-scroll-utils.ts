import {ListRange} from '../collections';

/** Historical bounds of the candidate ranges visited by a strategy. */
export interface VirtualScrollRenderedRange {
  start: number | null;
  end: number | null;
}

/** Expand a historical envelope to include the entire current candidate range. */
export function expandRenderedRange(
  renderedRange: VirtualScrollRenderedRange,
  newRange: ListRange,
): ListRange {
  renderedRange.start = Math.min(renderedRange.start ?? newRange.start, newRange.start);
  renderedRange.end = Math.max(renderedRange.end ?? newRange.end, newRange.end);

  return {start: renderedRange.start, end: renderedRange.end};
}
