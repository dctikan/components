import {Component, ViewChildren, QueryList} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {CdkFixedSizeVirtualScroll} from './fixed-size-virtual-scroll';
import {CdkVirtualForOf} from './virtual-for-of';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import {RecycleViewElementsState} from '../collections';

describe('CdkVirtualForOf in nested viewports', () => {
  it('renders each repeater against its nearest viewport and its own data length', async () => {
    const fixture = TestBed.createComponent(NestedVirtualForHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => requestAnimationFrame(resolve));
    await fixture.whenStable();
    fixture.detectChanges();

    const [outer, inner] = fixture.componentInstance.viewports.toArray();
    expect(outer.getDataLength()).toBe(2);
    expect(inner.getDataLength()).toBe(5);
    expect(inner.getRenderedRange()).toEqual({start: 0, end: 2});
    expect(inner.elementRef.nativeElement.querySelectorAll('.inner-item').length).toBe(2);
  });
});

describe('CdkVirtualForOf keyed inputs', () => {
  it('exposes the full-data trackBy identity and id context while retaining marked views', async () => {
    const fixture = TestBed.createComponent(KeyedVirtualForHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await new Promise(resolve => requestAnimationFrame(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
    const state = fixture.debugElement.injector.get(RecycleViewElementsState);
    const first =
      fixture.componentInstance.viewport.elementRef.nativeElement.querySelector('.keyed-item');
    state.markForDetach('row-0');
    expect(state.takeDetachedView('row-0')?.view).toBeTruthy();
    expect(first?.textContent).toContain('host-id');
    expect(fixture.componentInstance.repeater.cdkVirtualForCollectDetached).toBe('group');
    expect(fixture.componentInstance.repeater.cdkVirtualForRepeaterId).toBe('row');
    expect(fixture.componentInstance.repeater.cdkVirtualForGroupId).toBe('group');
  });
});

@Component({
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
  providers: [RecycleViewElementsState],
  template: `<cdk-virtual-scroll-viewport itemSize="50" style="height: 100px; width: 200px">
    <div class="keyed-item" *cdkVirtualFor="let item of items; let id = cdkVirtualForId; trackBy: trackBy; id: 'host-id'; collectDetached: 'group'; repeaterId: 'row'; groupId: 'group'; storeScrollPosition: true">{{item}} {{id}}</div>
  </cdk-virtual-scroll-viewport>`,
})
class KeyedVirtualForHost {
  @ViewChildren(CdkVirtualScrollViewport) viewports!: QueryList<CdkVirtualScrollViewport>;
  @ViewChildren(CdkVirtualForOf) repeaters!: QueryList<CdkVirtualForOf<string>>;
  items = ['row-0', 'row-1'];
  trackBy = (_index: number, item: string) => item;
  get viewport() {
    return this.viewports.first;
  }
  get repeater() {
    return this.repeaters.first;
  }
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" [minBufferPx]="0" [maxBufferPx]="0" [disableAppending]="true" style="height: 100px; width: 200px">
      <div *cdkVirtualFor="let item of outerItems" style="height: 50px">
        <cdk-virtual-scroll-viewport itemSize="50" [minBufferPx]="0" [maxBufferPx]="0" [disableAppending]="true" style="height: 100px; width: 200px">
          <div class="inner-item" *cdkVirtualFor="let child of innerItems" style="height: 50px">{{child}}</div>
        </cdk-virtual-scroll-viewport>
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
})
class NestedVirtualForHost {
  @ViewChildren(CdkVirtualScrollViewport) viewports!: QueryList<CdkVirtualScrollViewport>;
  outerItems = [0, 1];
  innerItems = [0, 1, 2, 3, 4];
}
