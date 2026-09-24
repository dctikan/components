/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ListRange} from '../collections';
import {Observable, Subject} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {expandRenderedRange, VirtualScrollRenderedRange} from './virtual-scroll-utils';
import {VirtualScrollStrategy} from './virtual-scroll-strategy';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import type {VisibleRange} from './cdk-visible-range.directive';

/** Virtual scrolling strategy for lists with caller-provided item sizes. */
export class CdkDynamicSizeVirtualScrollStrategy implements VirtualScrollStrategy {
  private readonly _scrolledIndexChange = new Subject<number>();

  /** @docs-private Implemented as part of VirtualScrollStrategy. */
  scrolledIndexChange: Observable<number> = this._scrolledIndexChange.pipe(distinctUntilChanged());

  /** Contiguous envelope of candidate ranges visited since the last reset. */
  renderedRange: VirtualScrollRenderedRange = {start: null, end: null};

  /** Optional row coordination for nested grid viewports. */
  gridRowIndex: number | undefined;
  gridVisibleRowRange: VisibleRange | null = null;

  setVisibleRowRange(range: VisibleRange | null) {
    this.gridVisibleRowRange = range;
    this._updateRangeIfVisible();
  }

  private _viewport: CdkVirtualScrollViewport | null = null;

  constructor(
    private _sizes: number[],
    private _minBufferPx: number,
    private _maxBufferPx: number,
    private _stretch: boolean,
    private _disableAppending = false,
  ) {}

  attach(viewport: CdkVirtualScrollViewport) {
    this._viewport = viewport;
    this._updateTotalContentSize();
  }

  detach() {
    this._scrolledIndexChange.complete();
    this._viewport = null;
  }

  updateItemAndBufferSize(
    sizes: number[],
    minBufferPx: number,
    maxBufferPx: number,
    stretch: boolean,
    disableAppending: boolean,
  ) {
    this.renderedRange = {start: null, end: null};

    if (maxBufferPx < minBufferPx && (typeof ngDevMode === 'undefined' || ngDevMode)) {
      throw Error('CDK virtual scroll: maxBufferPx must be greater than or equal to minBufferPx');
    }

    this._sizes = sizes;
    this._minBufferPx = minBufferPx;
    this._maxBufferPx = maxBufferPx;
    this._stretch = stretch;
    this._disableAppending = disableAppending;

    this._updateTotalContentSize();
    this._updateRangeIfVisible();
  }

  onContentScrolled() {
    this._updateRangeIfVisible();
  }

  onDataLengthChanged() {
    this.renderedRange = {start: null, end: null};
    this._updateTotalContentSize();
    this._updateRenderedRange();
  }

  onContentRendered() {
    /* no-op */
  }

  onRenderedOffsetChanged() {
    /* no-op */
  }

  scrollToIndex(index: number, behavior: ScrollBehavior): void {
    if (this._viewport) {
      this._viewport.scrollToOffset(this._getItemIdxByOffset(index), behavior);
    }
  }

  private _updateRangeIfVisible() {
    if (
      this.gridRowIndex === undefined ||
      !this.gridVisibleRowRange ||
      (this.gridRowIndex >= this.gridVisibleRowRange.start &&
        this.gridRowIndex <= this.gridVisibleRowRange.end)
    ) {
      this._updateRenderedRange();
    }
  }

  private _updateTotalContentSize() {
    if (!this._viewport) {
      return;
    }

    const contentSize = this._sumSizes(this._sizes);
    this._viewport._contentWrapper.nativeElement.style.height =
      this._stretch && this._viewport.getViewportSize() > contentSize ? '100%' : '';
    this._viewport.setTotalContentSize(contentSize);
  }

  private _updateRenderedRange() {
    if (!this._viewport) {
      return;
    }

    const renderedRange = this._viewport.getRenderedRange();
    let newRange = {start: renderedRange.start, end: renderedRange.end};
    const viewportSize = this._viewport.getViewportSize();
    const dataLength = this._viewport.getDataLength();
    let scrollOffset = this._viewport.measureScrollOffset();
    let firstVisibleIndex = this._getItemIdxByOffset(scrollOffset);

    if (newRange.end > dataLength) {
      ({firstVisibleIndex, scrollOffset, newRange} = this._adjustRangeForReducedDataLength(
        firstVisibleIndex,
        scrollOffset,
        viewportSize,
        dataLength,
        newRange,
      ));
    }

    const startBuffer = scrollOffset - this._getOffsetByItemIdx(newRange.start);
    const endBuffer = this._getOffsetByItemIdx(newRange.end) - (scrollOffset + viewportSize);

    if (startBuffer < this._minBufferPx || endBuffer < this._minBufferPx) {
      newRange.start = Math.max(0, this._getItemIdxByOffset(scrollOffset - this._maxBufferPx));
      newRange.end = Math.min(
        dataLength,
        this._getItemIdxByOffset(scrollOffset + viewportSize + this._maxBufferPx) + 1,
      );
    }

    if (!this._disableAppending) {
      newRange = expandRenderedRange(this.renderedRange, newRange);
    }

    this._viewport.setRenderedRange(newRange);
    this._viewport.setRenderedContentOffset(this._getOffsetByItemIdx(newRange.start));
    this._scrolledIndexChange.next(firstVisibleIndex);
  }

  private _sumSizes(sizes: number[]): number {
    return sizes.reduce((sum, size) => sum + size, 0);
  }

  private _adjustRangeForReducedDataLength(
    firstVisibleIndex: number,
    scrollOffset: number,
    viewportSize: number,
    dataLength: number,
    newRange: ListRange,
  ): {firstVisibleIndex: number; scrollOffset: number; newRange: ListRange} {
    const lastVisibleIndex = this._getItemIdxByOffset(scrollOffset + viewportSize);
    const newVisibleIndex = this._getItemIdxByOffset(viewportSize, lastVisibleIndex, 'down');

    if (firstVisibleIndex !== newVisibleIndex) {
      firstVisibleIndex = newVisibleIndex;
      scrollOffset = this._getOffsetByItemIdx(newVisibleIndex);
      newRange.start = firstVisibleIndex;
    }

    const endRange = this._getItemIdxByOffset(scrollOffset + viewportSize) + 1;
    return {
      firstVisibleIndex,
      scrollOffset,
      newRange: {
        start: newRange.start,
        end: Math.max(0, Math.min(dataLength, endRange)),
      },
    };
  }

  private _getOffsetByItemIdx(index: number): number {
    return this._sumSizes(this._sizes.slice(0, index));
  }

  private _getItemIdxByOffset(
    offset: number,
    offsetIdx: number = 0,
    direction: 'down' | 'up' = 'up',
  ): number {
    let accumulatedOffset = 0;

    for (
      let index = offsetIdx;
      index < this._sizes.length && index >= 0;
      direction === 'down' ? index-- : index++
    ) {
      accumulatedOffset += this._sizes[index];
      if (accumulatedOffset >= offset) {
        return index;
      }
    }

    return accumulatedOffset < offset && direction === 'up' ? this._sizes.length - 1 : 0;
  }
}
