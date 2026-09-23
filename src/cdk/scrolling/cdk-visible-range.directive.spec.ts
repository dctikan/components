import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {dispatchFakeEvent} from '../testing/private';
import {CdkVisibleRange} from './cdk-visible-range.directive';
import {ScrollingModule} from './scrolling-module';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';

@Component({
  template: `
    <cdk-virtual-scroll-viewport [itemSize]="50" [minBufferPx]="0" [maxBufferPx]="100"
      [disableAppending]="true" visibleRange #visible="visibleRange"
      style="height: 200px; width: 100px">
      <div *cdkVirtualFor="let item of items" style="height: 50px">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class VisibleRangeHost {
  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('visible') visible!: CdkVisibleRange;
  items = Array.from({length: 20}, (_, index) => index);
}

describe('CdkVisibleRange (preserved unused export)', () => {
  let fixture: ComponentFixture<VisibleRangeHost>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(VisibleRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('reports the buffered fixed-size row window as an exclusive-end range', async () => {
    expect(fixture.componentInstance.visible.range).toEqual({start: 0, end: 6});
    fixture.componentInstance.viewport.scrollToOffset(200);
    dispatchFakeEvent(fixture.componentInstance.viewport.elementRef.nativeElement, 'scroll');
    await new Promise(resolve => setTimeout(resolve, 20));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.visible.range).toEqual({start: 2, end: 10});
  });

  it('clamps the buffered range after the data set shrinks', async () => {
    fixture.componentInstance.items = [0, 1, 2];
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.visible.range).toEqual({start: 0, end: 3});
  });
});
