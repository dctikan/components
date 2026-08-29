import {
  Component,
  Input,
  QueryList,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {CdkDynamicSizeVirtualScroll} from './dynamic-size.directive';
import {CdkVisibleRange} from './cdk-visible-range.directive';
import {CdkVirtualForOf} from './virtual-for-of';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import {ScrollingModule} from './scrolling-module';
import {dispatchFakeEvent} from '../testing/private';

describe('fixed-parent / dynamic-child visibleRange fixture', () => {
  it('throws on the dormant production same-element [visibleRange] child binding', fakeAsync(() => {
    TestBed.configureTestingModule({
      imports: [ScrollingModule, SameElementNestedHost],
    });

    expect(() => {
      const fixture = TestBed.createComponent(SameElementNestedHost);
      fixture.detectChanges();
      flush();
    }).toThrowError(/CdkFixedSizeVirtualScroll|NullInjectorError/);
  }));

  describe('split-import child that preserves gating', () => {
    let fixture: ComponentFixture<NestedVisibleRangeHost>;
    let testHost: NestedVisibleRangeHost;

    beforeEach(waitForAsync(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ScrollingModule, NestedVisibleRangeHost],
      });
    }));

    beforeEach(() => {
      fixture = TestBed.createComponent(NestedVisibleRangeHost);
      testHost = fixture.componentInstance;
    });

    it('updates a child whose rowindex is inside the inclusive coordination end', fakeAsync(() => {
      finishInit(fixture);
      const childRows = testHost.childRows.toArray();
      const insideChild = childRows[0];
      const beforeRange = insideChild.viewport.getRenderedRange();

      insideChild.viewport.scrollToOffset(80);
      dispatchFakeEvent(insideChild.viewport.scrollable!.getElementRef().nativeElement, 'scroll');
      tick(16);
      fixture.detectChanges();
      flush();

      expect(testHost.parentVisible.range)
        .withContext(
          'coordination end is inclusive for rowindex; DOM ListRange end stays exclusive',
        )
        .toEqual({start: 0, end: 6});
      expect(insideChild.rowindex).toBeLessThanOrEqual(testHost.parentVisible.range.end);
      expect(insideChild.viewport.getRenderedRange()).toEqual({start: 1, end: 3});
    }));

    it('does not update a child whose rowindex is greater than the inclusive coordination end', fakeAsync(() => {
      finishInit(fixture);
      triggerScroll(testHost.parentViewport, 0);
      fixture.detectChanges();
      flush();

      const mountedOutsideRow = testHost.childRows
        .toArray()
        .find(childRow => childRow.rowindex > testHost.parentVisible.range.end);
      const outsideRow = mountedOutsideRow ?? createOutsideNestedRow(testHost.parentVisible.range);
      expect(outsideRow).toBeDefined();
      expect(outsideRow.rowindex).toBeGreaterThan(testHost.parentVisible.range.end);
      expect(testHost.parentVisible.range.end).toBe(6);
      const beforeRange = outsideRow.viewport.getRenderedRange();

      outsideRow.viewport.scrollToOffset(80);
      dispatchFakeEvent(outsideRow.viewport.scrollable!.getElementRef().nativeElement, 'scroll');
      tick(16);
      fixture.detectChanges();
      flush();

      expect(outsideRow.viewport.getRenderedRange()).toEqual(beforeRange);
    }));
  });
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

function createOutsideNestedRow(coordinationRange: {
  start: number;
  end: number;
}): NestedRowComponent {
  const outsideFixture = TestBed.createComponent(NestedRowComponent);
  outsideFixture.componentInstance.visibleRange = coordinationRange;
  outsideFixture.componentInstance.rowindex = coordinationRange.end + 1;
  finishInit(outsideFixture);
  return outsideFixture.componentInstance;
}

@Component({
  selector: 'nested-row',
  template: `
    <cdk-virtual-scroll-viewport
        class="child-viewport"
        orientation="horizontal"
        dynamicSize
        [sizes]="columnSizes"
        [visibleRange]="visibleRange"
        [rowindex]="rowindex"
        [disableAppending]="true"
        [minBufferPx]="0"
        [maxBufferPx]="80"
        [style.height.px]="50"
        [style.width.px]="160">
      <div class="cell"
           *cdkVirtualFor="let cell of cells; templateCacheSize: 0"
           [style.width.px]="80"
           [style.height.px]="50">
        {{cell}}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: row; }
    .child-viewport { display: block; }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [CdkDynamicSizeVirtualScroll, CdkVirtualScrollViewport, CdkVirtualForOf],
})
class NestedRowComponent {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport: CdkVirtualScrollViewport;
  @ViewChild(CdkDynamicSizeVirtualScroll, {static: true}) dynamicSize: CdkDynamicSizeVirtualScroll;

  @Input() visibleRange: {start: number; end: number} | null = null;
  @Input() rowindex = 0;

  cells = [0, 1, 2, 3, 4, 5];
  columnSizes = [80, 80, 80, 80, 80, 80];
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        class="parent-viewport"
        [itemSize]="50"
        [minBufferPx]="0"
        [maxBufferPx]="100"
        [disableAppending]="true"
        visibleRange
        #visibleRangeRef="visibleRange"
        [style.height.px]="200"
        [style.width.px]="160">
      <nested-row
          *cdkVirtualFor="let row of rows; let rowIndex = index; templateCacheSize: 0"
          [visibleRange]="visibleRangeRef.range"
          [rowindex]="rowIndex">
      </nested-row>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; }
    .parent-viewport { display: block; }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule, NestedRowComponent],
})
class NestedVisibleRangeHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) parentViewport: CdkVirtualScrollViewport;
  @ViewChild(CdkVisibleRange, {static: true}) parentVisible: CdkVisibleRange;
  @ViewChild(NestedRowComponent) firstChild: NestedRowComponent;
  @ViewChildren(NestedRowComponent) childRows: QueryList<NestedRowComponent>;

  rows = Array.from({length: 12}, (_, rowIndex) => rowIndex);
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        [itemSize]="50"
        visibleRange
        #visibleRangeRef="visibleRange"
        [style.height.px]="200"
        [style.width.px]="160">
      <cdk-virtual-scroll-viewport
          dynamicSize
          [sizes]="columnSizes"
          [visibleRange]="visibleRangeRef.range"
          [rowindex]="0"
          [style.height.px]="50"
          [style.width.px]="160">
        <div *cdkVirtualFor="let cell of cells">{{cell}}</div>
      </cdk-virtual-scroll-viewport>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class SameElementNestedHost {
  cells = [0, 1, 2];
  columnSizes = [80, 80, 80];
}
