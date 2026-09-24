/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {AfterViewInit, Directive, ElementRef, inject, OnDestroy} from '@angular/core';

/** Moves vertical wrapper translation to `top` so descendants can remain sticky. */
@Directive({selector: 'cdk-virtual-scroll-viewport[cdkVirtualScrollSticky]'})
export class CdkVirtualScrollSticky implements AfterViewInit, OnDestroy {
  private readonly _elementRef = inject(ElementRef<HTMLElement>);
  private _observer: MutationObserver | null = null;

  ngAfterViewInit() {
    const wrapper = (this._elementRef.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '.cdk-virtual-scroll-content-wrapper',
    );
    if (!wrapper) {
      return;
    }

    this._applyTransformFix(wrapper);
    if (typeof MutationObserver === 'undefined') {
      return;
    }
    this._observer = new MutationObserver(() => this._applyTransformFix(wrapper));
    this._observer.observe(wrapper, {attributes: true, attributeFilter: ['style']});
  }

  ngOnDestroy() {
    this._observer?.disconnect();
    this._observer = null;
  }

  private _applyTransformFix(wrapper: HTMLElement) {
    const transform = wrapper.style.transform;
    const vertical = /^translateY\(([-\d.]+)px\)$/.exec(transform);
    if (vertical) {
      wrapper.style.top = `${parseFloat(vertical[1])}px`;
      wrapper.style.transform = 'none';
    } else if (transform && transform !== 'none' && wrapper.style.top) {
      wrapper.style.top = '';
    }
  }
}
