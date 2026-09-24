/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {ChangeDetectorRef, Directive, inject, OnDestroy} from '@angular/core';
import {merge, Subscription} from 'rxjs';
import {CdkFixedSizeVirtualScroll} from './fixed-size-virtual-scroll';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';

/** The buffered rows of a fixed-size parent viewport (exclusive end). */
export type VisibleRange = {start: number; end: number};

/** Preserved for nested viewports that opt into visible-row coordination. */
@Directive({selector: '[visibleRange]', exportAs: 'visibleRange'})
export class CdkVisibleRange implements OnDestroy {
  private readonly _viewport = inject(CdkVirtualScrollViewport, {self: true});
  private readonly _fixedSize = inject(CdkFixedSizeVirtualScroll, {self: true});
  private readonly _cdr = inject(ChangeDetectorRef);
  private readonly _subscription: Subscription;
  private _firstVisibleIndex = 0;

  private _range: VisibleRange = {start: 0, end: 0};

  constructor() {
    this._subscription = merge(
      this._viewport.scrolledIndexChange,
      this._viewport.renderedRangeStream,
    ).subscribe(value => {
      if (typeof value === 'number') {
        this._firstVisibleIndex = value;
      }
      this._updateRange();
    });
  }

  get range(): VisibleRange {
    return this._range;
  }

  ngOnDestroy() {
    this._subscription.unsubscribe();
  }

  private _updateRange() {
    const itemSize = this._fixedSize.itemSize;
    if (itemSize <= 0) {
      return;
    }
    const dataLength = this._viewport.getDataLength();
    const visibleItems = Math.ceil(this._viewport.getViewportSize() / itemSize);
    const bufferedItems = Math.ceil(this._fixedSize.maxBufferPx / itemSize);
    const firstVisibleIndex = Math.min(
      this._firstVisibleIndex,
      Math.max(0, dataLength - visibleItems),
    );
    this._range = {
      start: Math.max(0, firstVisibleIndex - bufferedItems),
      end: Math.min(dataLength, firstVisibleIndex + visibleItems + bufferedItems),
    };
    this._cdr.markForCheck();
  }
}
