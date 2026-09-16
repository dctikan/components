import {Component, ViewChild} from '@angular/core';
import {TestBed, fakeAsync, flush} from '@angular/core/testing';
import {
  CdkDynamicSizeVirtualScroll,
  CdkDynamicSizeVirtualScrollStrategy,
  CdkVisibleRange,
  CdkVirtualScrollSticky,
  ScrollingModule,
  VIRTUAL_SCROLL_STRATEGY,
  _dynamicSizeVirtualScrollStrategyFactory,
} from './public-api';
import {CdkVirtualScrollViewport} from './public-api';
import * as scrollingPublicApi from './public-api';

describe('ScrollingModule and scrolling public-api', () => {
  const requiredExports: Array<[string, unknown]> = [
    ['CdkDynamicSizeVirtualScroll', CdkDynamicSizeVirtualScroll],
    ['CdkDynamicSizeVirtualScrollStrategy', CdkDynamicSizeVirtualScrollStrategy],
    ['CdkVisibleRange', CdkVisibleRange],
    ['CdkVirtualScrollSticky', CdkVirtualScrollSticky],
    ['ScrollingModule', ScrollingModule],
    ['VIRTUAL_SCROLL_STRATEGY', VIRTUAL_SCROLL_STRATEGY],
    ['_dynamicSizeVirtualScrollStrategyFactory', _dynamicSizeVirtualScrollStrategyFactory],
    ['CdkVirtualScrollViewport', CdkVirtualScrollViewport],
  ];

  requiredExports.forEach(([exportName, exportValue]) => {
    it(`exports ${exportName} from scrolling/public-api`, () => {
      expect(exportValue).toBeTruthy();
    });
  });

  it('does not export expandRenderedRange from scrolling/public-api', () => {
    expect('expandRenderedRange' in scrollingPublicApi).toBe(false);
  });

  it('does not export a runtime VisibleRange value; it is a type-only public-api re-export', () => {
    expect('VisibleRange' in scrollingPublicApi).toBe(false);
  });

  it('does not export VirtualScrollRenderedRange from scrolling/public-api', () => {
    expect('VirtualScrollRenderedRange' in scrollingPublicApi).toBe(false);
  });

  it('compiles every fork selector through ScrollingModule', fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [ModuleContractHost],
    });
    const fixture = TestBed.createComponent(ModuleContractHost);
    fixture.detectChanges();
    flush();

    expect(fixture.componentInstance.dynamicSize).toBeInstanceOf(CdkDynamicSizeVirtualScroll);
    expect(fixture.componentInstance.visibleRange).toBeInstanceOf(CdkVisibleRange);
    expect(fixture.componentInstance.sticky).toBeInstanceOf(CdkVirtualScrollSticky);
    expect(
      fixture.nativeElement.querySelector(
        '[dynamicsize], [dynamicSize], cdk-virtual-scroll-viewport',
      ),
    ).toBeTruthy();
  }));
});

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        [itemSize]="50"
        visibleRange
        cdkVirtualScrollSticky
        [style.height.px]="200"
        [style.width.px]="200">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
    <cdk-virtual-scroll-viewport
        dynamicSize
        [sizes]="sizes"
        [style.height.px]="200"
        [style.width.px]="200">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class ModuleContractHost {
  @ViewChild(CdkDynamicSizeVirtualScroll) dynamicSize: CdkDynamicSizeVirtualScroll;
  @ViewChild(CdkVisibleRange) visibleRange: CdkVisibleRange;
  @ViewChild(CdkVirtualScrollSticky) sticky: CdkVirtualScrollSticky;
  items = [0, 1, 2];
  sizes = [50, 50, 50];
}
