import {Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {CdkVisibleRange} from './cdk-visible-range.directive';
import {
  CdkFixedSizeVirtualScroll,
  FixedSizeVirtualScrollStrategy,
} from './fixed-size-virtual-scroll';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import {ScrollingModule} from './scrolling-module';
import {dispatchFakeEvent} from '../testing/private';

describe('CdkVisibleRange', () => {
  let fixture: ComponentFixture<VisibleRangeHost>;
  let testHost: VisibleRangeHost;
  let viewport: CdkVirtualScrollViewport;
  let visibleRange: CdkVisibleRange;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ScrollingModule, VisibleRangeHost],
    });
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VisibleRangeHost);
    testHost = fixture.componentInstance;
    viewport = testHost.viewport;
    visibleRange = testHost.visibleRange;
  });

  it('computes start from firstVisibleIndex minus ceil(maxBufferPx / itemSize)', fakeAsync(() => {
    finishInit(fixture);

    expect(visibleRange.range).toEqual({start: 0, end: 6});
  }));

  it('sets end to firstVisibleIndex + visibleItems + bufferedItems with no + 1', fakeAsync(() => {
    finishInit(fixture);
    triggerScroll(viewport, 200);
    fixture.detectChanges();
    flush();

    expect(testHost.scrolledToIndex).toBe(4);
    expect(visibleRange.range).toEqual({start: 2, end: 10});
  }));

  it('clamps the requested offset and visible range to the data length', fakeAsync(() => {
    finishInit(fixture);
    triggerScroll(viewport, 900);
    fixture.detectChanges();
    flush();

    expect(testHost.scrolledToIndex).toBe(16);
    expect(visibleRange.range.start).toBe(14);
    expect(visibleRange.range.end).toBe(20);
  }));

  it('uses maxBufferPx not minBufferPx as the buffered row width', fakeAsync(() => {
    testHost.minBufferPx = 0;
    testHost.maxBufferPx = 150;
    finishInit(fixture);

    expect(visibleRange.range).toEqual({start: 0, end: 7});
  }));

  it('refreshes from the adjusted first-visible index when data length shrinks', fakeAsync(() => {
    finishInit(fixture);
    triggerScroll(viewport, 200);
    fixture.detectChanges();
    flush();
    expect(visibleRange.range).toEqual({start: 2, end: 10});

    testHost.items = Array.from({length: 5}, (_, itemIndex) => itemIndex);
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();

    expect(visibleRange.range).toEqual({start: 0, end: 5});
  }));

  it('does not refresh when itemSize changes until the next scroll or data-length event', fakeAsync(() => {
    finishInit(fixture);
    expect(visibleRange.range).toEqual({start: 0, end: 6});

    testHost.itemSize = 25;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();

    expect(visibleRange.range)
      .withContext('itemSize change has no listener; range stays stale until scroll or data length')
      .toEqual({start: 0, end: 6});
  }));

  it('refreshes after checkViewportSize because that path calls onDataLengthChanged', fakeAsync(() => {
    finishInit(fixture);
    testHost.viewportSize = 400;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();
    viewport.checkViewportSize();
    fixture.detectChanges();
    flush();

    expect(visibleRange.range).toEqual({start: 0, end: 10});
  }));

  it('does not apply a page-offset translation; firstVisibleIndex is used as-is', fakeAsync(() => {
    finishInit(fixture);
    triggerScroll(viewport, 200);
    fixture.detectChanges();
    flush();

    expect(testHost.scrolledToIndex).toBe(4);
    expect(visibleRange.range.start).toBe(2);
    expect(visibleRange.range.end).toBe(10);
  }));

  it('restores the original onDataLengthChanged and closes the scrolledIndexChange subscription on destroy', fakeAsync(() => {
    const originalCallback = FixedSizeVirtualScrollStrategy.prototype.onDataLengthChanged;
    finishInit(fixture);
    const scrollStrategy = testHost.fixedSize._scrollStrategy;
    const patchedCallback = scrollStrategy.onDataLengthChanged;
    const rangeSubscription = (
      visibleRange as unknown as {
        _scrolledIndexChangeSubscription?: {closed: boolean};
      }
    )._scrolledIndexChangeSubscription;
    const rangeBeforeDestroy = {...visibleRange.range};

    expect(patchedCallback).not.toBe(originalCallback);
    expect(rangeSubscription?.closed).toBe(false);

    fixture.destroy();

    expect(scrollStrategy.onDataLengthChanged).toBe(originalCallback);
    expect(rangeSubscription?.closed).toBe(true);

    scrollStrategy.onDataLengthChanged();
    expect(visibleRange.range).toEqual(rangeBeforeDestroy);
  }));
});

describe('CdkVisibleRange unsupported and multiple hosts', () => {
  it('throws when [visibleRange] is placed on a dynamicSize viewport that has no CdkFixedSizeVirtualScroll', fakeAsync(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ScrollingModule, DynamicVisibleRangeHost],
    });

    expect(() => {
      const fixture = TestBed.createComponent(DynamicVisibleRangeHost);
      fixture.detectChanges();
      flush();
    }).toThrowError(/CdkFixedSizeVirtualScroll|NullInjectorError/);
  }));

  it('keeps independent ranges on two fixed-size viewports', fakeAsync(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ScrollingModule, DualVisibleRangeHost],
    });
    const fixture = TestBed.createComponent(DualVisibleRangeHost);
    finishInit(fixture);
    triggerScroll(fixture.componentInstance.firstViewport, 200);
    fixture.detectChanges();
    flush();

    expect(fixture.componentInstance.firstVisible.range).toEqual({start: 2, end: 10});
    expect(fixture.componentInstance.secondVisible.range).toEqual({start: 0, end: 6});
  }));
});

function finishInit(fixture: ComponentFixture<unknown>) {
  fixture.detectChanges();
  flush();
  fixture.detectChanges();
  flush();
  tick(16);
  flush();
  fixture.detectChanges();
}

function triggerScroll(viewport: CdkVirtualScrollViewport, offset?: number) {
  if (offset !== undefined) {
    viewport.scrollToOffset(offset);
  }
  dispatchFakeEvent(viewport.scrollable!.getElementRef().nativeElement, 'scroll');
  tick(16);
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        [itemSize]="itemSize"
        [minBufferPx]="minBufferPx"
        [maxBufferPx]="maxBufferPx"
        [disableAppending]="true"
        visibleRange
        #visibleRangeRef="visibleRange"
        [style.height.px]="viewportSize"
        [style.width.px]="100"
        (scrolledIndexChange)="scrolledToIndex = $event">
      <div class="item"
           *cdkVirtualFor="let item of items; templateCacheSize: 0"
           [style.height.px]="itemSize"
           [style.width.px]="50">
        {{item}}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
})
class VisibleRangeHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport: CdkVirtualScrollViewport;
  @ViewChild(CdkVisibleRange, {static: true}) visibleRange: CdkVisibleRange;
  @ViewChild(CdkFixedSizeVirtualScroll, {static: true}) fixedSize: CdkFixedSizeVirtualScroll;

  itemSize = 50;
  minBufferPx = 0;
  maxBufferPx = 100;
  viewportSize = 200;
  scrolledToIndex = 0;
  items = Array.from({length: 20}, (_, itemIndex) => itemIndex);
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        dynamicSize
        [sizes]="sizes"
        visibleRange
        [style.height.px]="200"
        [style.width.px]="100">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class DynamicVisibleRangeHost {
  items = [0, 1, 2];
  sizes = [50, 50, 50];
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        [itemSize]="50"
        [minBufferPx]="0"
        [maxBufferPx]="100"
        [disableAppending]="true"
        visibleRange
        #firstRange="visibleRange"
        [style.height.px]="200"
        [style.width.px]="100">
      <div class="item" *cdkVirtualFor="let item of items" [style.height.px]="50">{{item}}</div>
    </cdk-virtual-scroll-viewport>
    <cdk-virtual-scroll-viewport
        [itemSize]="50"
        [minBufferPx]="0"
        [maxBufferPx]="100"
        [disableAppending]="true"
        visibleRange
        #secondRange="visibleRange"
        [style.height.px]="200"
        [style.width.px]="100">
      <div class="item" *cdkVirtualFor="let item of items" [style.height.px]="50">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
})
class DualVisibleRangeHost {
  @ViewChild('firstRange', {static: true}) firstVisible: CdkVisibleRange;
  @ViewChild('secondRange', {static: true}) secondVisible: CdkVisibleRange;
  @ViewChild(CdkVirtualScrollViewport, {static: true}) firstViewport: CdkVirtualScrollViewport;
  items = Array.from({length: 20}, (_, itemIndex) => itemIndex);
}
