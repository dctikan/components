import {coerceNumberProperty, NumberInput} from '../coercion';
import {Directive, forwardRef, Input, OnChanges} from '@angular/core';
import {CdkDynamicSizeVirtualScrollStrategy} from './dynamic-size-strategy';
import type {VisibleRange} from './cdk-visible-range.directive';
import {VIRTUAL_SCROLL_STRATEGY} from './virtual-scroll-strategy';

/** Extract the strategy owned by the dynamic-size directive. */
export function _dynamicSizeVirtualScrollStrategyFactory(directive: CdkDynamicSizeVirtualScroll) {
  return directive._scrollStrategy;
}

/** Virtual scrolling for items whose sizes are known but not uniform. */
@Directive({
  selector: 'cdk-virtual-scroll-viewport[dynamicSize]',
  providers: [
    {
      provide: VIRTUAL_SCROLL_STRATEGY,
      useFactory: _dynamicSizeVirtualScrollStrategyFactory,
      deps: [forwardRef(() => CdkDynamicSizeVirtualScroll)],
    },
  ],
})
export class CdkDynamicSizeVirtualScroll implements OnChanges {
  @Input() name!: string;
  @Input() disableAppending = false;
  @Input() sizes: number[] = [];
  @Input() stretch = false;

  @Input()
  set visibleRange(range: VisibleRange | null) {
    this._scrollStrategy.setVisibleRowRange(range);
  }

  @Input()
  set rowindex(index: number | undefined) {
    this._scrollStrategy.gridRowIndex = index;
  }

  @Input()
  get minBufferPx(): number {
    return this._minBufferPx;
  }
  set minBufferPx(value: NumberInput) {
    this._minBufferPx = coerceNumberProperty(value);
  }
  _minBufferPx = 100;

  @Input()
  get maxBufferPx(): number {
    return this._maxBufferPx;
  }
  set maxBufferPx(value: NumberInput) {
    this._maxBufferPx = coerceNumberProperty(value);
  }
  _maxBufferPx = 200;

  /** Strategy shared with the viewport through VIRTUAL_SCROLL_STRATEGY. */
  _scrollStrategy = new CdkDynamicSizeVirtualScrollStrategy(
    this.sizes,
    this.minBufferPx,
    this.maxBufferPx,
    this.stretch,
    this.disableAppending,
  );

  ngOnChanges() {
    this._scrollStrategy.updateItemAndBufferSize(
      this.sizes,
      this.minBufferPx,
      this.maxBufferPx,
      this.stretch,
      this.disableAppending,
    );
  }
}
