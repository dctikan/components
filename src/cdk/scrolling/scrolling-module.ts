/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {BidiModule} from '../bidi';
import {NgModule} from '@angular/core';
import {CdkVisibleRange} from './cdk-visible-range.directive';
import {CdkDynamicSizeVirtualScroll} from './dynamic-size.directive';
import {CdkFixedSizeVirtualScroll} from './fixed-size-virtual-scroll';
import {CdkScrollable} from './scrollable';
import {CdkVirtualForOf} from './virtual-for-of';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import {CdkVirtualScrollSticky} from './virtual-scroll-sticky.directive';
import {CdkVirtualScrollableElement} from './virtual-scrollable-element';
import {CdkVirtualScrollableWindow} from './virtual-scrollable-window';

@NgModule({
  exports: [CdkScrollable],
  imports: [CdkScrollable],
})
export class CdkScrollableModule {}

/**
 * @docs-primary-export
 */
@NgModule({
  imports: [
    BidiModule,
    CdkScrollableModule,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkDynamicSizeVirtualScroll,
    CdkVisibleRange,
    CdkVirtualScrollSticky,
    CdkVirtualForOf,
    CdkVirtualScrollableWindow,
    CdkVirtualScrollableElement,
  ],
  exports: [
    BidiModule,
    CdkScrollableModule,
    CdkFixedSizeVirtualScroll,
    CdkDynamicSizeVirtualScroll,
    CdkVisibleRange,
    CdkVirtualScrollSticky,
    CdkVirtualForOf,
    CdkVirtualScrollViewport,
    CdkVirtualScrollableWindow,
    CdkVirtualScrollableElement,
  ],
})
export class ScrollingModule {}

// Re-export needed by the Angular compiler.
// See: https://github.com/angular/components/issues/30663.
// Note: These exports need to be stable and shouldn't be renamed unnecessarily because
// consuming libraries might have references to them in their own partial compilation output.
export {Dir as ɵɵDir} from '../bidi';
