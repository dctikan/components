import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {dispatchFakeEvent} from '../testing/private';
import {CdkDynamicSizeVirtualScroll} from './dynamic-size.directive';
import {CdkVirtualForOf} from './virtual-for-of';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';

describe('dynamic-size offsets and ranges', () => {
  let fixture: ComponentFixture<DynamicSizeHost>;
  let viewport: CdkVirtualScrollViewport;

  beforeEach(async () => {
    fixture = TestBed.createComponent(DynamicSizeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    viewport = fixture.componentInstance.viewport;
  });

  async function scrollTo(offset: number) {
    viewport.scrollToOffset(offset);
    dispatchFakeEvent(viewport.scrollable!.getElementRef().nativeElement, 'scroll');
    await new Promise(resolve => setTimeout(resolve, 20));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('uses cumulative item sizes for the total size and initial buffered window', () => {
    expect(viewport._totalContentHeight()).toBe('1600px');
    expect(viewport.getRenderedRange()).toEqual({start: 0, end: 4});
  });

  it('includes the item ending at an exact buffer boundary and offsets the rendered content', async () => {
    fixture.componentInstance.disableAppending = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    await scrollTo(600);

    expect(viewport.getRenderedRange()).toEqual({start: 1, end: 7});
    expect(viewport.getOffsetToRenderedContentStart()).toBe(200);
    expect(fixture.componentInstance.firstVisibleIndex).toBe(2);
  });

  it('rebuilds the window when sizes change without changing item count', async () => {
    fixture.componentInstance.sizes = [200, 400, 200, 400, 100, 100, 200, 200];
    fixture.componentInstance.disableAppending = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    await scrollTo(600);

    expect(viewport.getRenderedRange()).toEqual({start: 1, end: 6});
    expect(viewport.getOffsetToRenderedContentStart()).toBe(200);
  });

  it('keeps previously visited ranges by default but shrinks when appending is disabled', async () => {
    await scrollTo(1000);
    expect(viewport.getRenderedRange()).toEqual({start: 0, end: 8});

    fixture.componentInstance.disableAppending = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    await scrollTo(1000);
    expect(viewport.getRenderedRange()).toEqual({start: 3, end: 8});
    expect(viewport.getOffsetToRenderedContentStart()).toBe(600);
  });

  it('uses the current dynamic-size window after disabling appending and scrolling back', async () => {
    fixture.componentInstance.disableAppending = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await fixture.whenStable();
    await scrollTo(1000);
    expect(viewport.getRenderedRange()).toEqual({start: 3, end: 8});

    await scrollTo(600);
    expect(viewport.getRenderedRange()).toEqual({start: 1, end: 7});
    expect(viewport.getOffsetToRenderedContentStart()).toBe(200);
  });

  it('defers scroll-driven range updates for a row outside the parent visible range', async () => {
    fixture.componentInstance.rowindex = 8;
    fixture.componentInstance.visibleRange = {start: 0, end: 3};
    fixture.componentInstance.disableAppending = true;
    fixture.detectChanges();
    await fixture.whenStable();
    const before = viewport.getRenderedRange();

    await scrollTo(1000);
    expect(viewport.getRenderedRange()).toEqual(before);

    fixture.componentInstance.visibleRange = {start: 7, end: 9};
    fixture.detectChanges();
    await fixture.whenStable();
    await scrollTo(600);
    expect(viewport.getRenderedRange()).toEqual({start: 1, end: 7});
  });

  it('updates a deferred row when it becomes visible without another child scroll', async () => {
    fixture.componentInstance.rowindex = 8;
    fixture.componentInstance.visibleRange = {start: 0, end: 3};
    fixture.componentInstance.disableAppending = true;
    fixture.detectChanges();
    await fixture.whenStable();
    const before = viewport.getRenderedRange();

    await scrollTo(1000);
    expect(viewport.getRenderedRange()).toEqual(before);

    fixture.componentInstance.visibleRange = {start: 7, end: 9};
    fixture.detectChanges();
    await fixture.whenStable();
    expect(viewport.getRenderedRange()).toEqual({start: 3, end: 8});
    expect(viewport.getOffsetToRenderedContentStart()).toBe(600);
  });
});

@Component({
  template: `
    <cdk-virtual-scroll-viewport dynamicSize [sizes]="sizes"
        [rowindex]="rowindex" [visibleRange]="visibleRange"
        [minBufferPx]="100" [maxBufferPx]="200" [disableAppending]="disableAppending"
        [style.height.px]="600" [style.width.px]="300"
        (scrolledIndexChange)="firstVisibleIndex = $event">
      <div *cdkVirtualFor="let item of items" [style.height.px]="sizes[item]">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [CdkVirtualScrollViewport, CdkDynamicSizeVirtualScroll, CdkVirtualForOf],
})
class DynamicSizeHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport!: CdkVirtualScrollViewport;
  items = [0, 1, 2, 3, 4, 5, 6, 7];
  sizes = [200, 200, 200, 200, 200, 200, 200, 200];
  disableAppending = false;
  rowindex: number | undefined;
  visibleRange: {start: number; end: number} | null = null;
  firstVisibleIndex: number | null = null;
}
