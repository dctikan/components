import {Component, ViewChild} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {CdkDynamicSizeVirtualScroll} from './dynamic-size.directive';
import {CdkVirtualForOf} from './virtual-for-of';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import {VIRTUAL_SCROLL_STRATEGY} from './virtual-scroll-strategy';

describe('CdkDynamicSizeVirtualScroll', () => {
  let fixture: ComponentFixture<DynamicSizeDirectiveHost>;

  beforeEach(() => {
    fixture = TestBed.createComponent(DynamicSizeDirectiveHost);
  });

  it('provides its strategy to the viewport and updates the content size from bound sizes', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const host = fixture.componentInstance;
    expect(fixture.debugElement.children[0].injector.get(VIRTUAL_SCROLL_STRATEGY)).toBe(
      host.dynamicSize._scrollStrategy,
    );
    expect(host.viewport.getDataLength()).toBe(3);
    expect(host.viewport._totalContentHeight()).toBe('260px');

    host.sizes = [40, 80, 120];
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    expect(host.viewport._totalContentHeight()).toBe('240px');
  });

  it('stretches the content wrapper when total size is smaller than the viewport', async () => {
    fixture.componentInstance.stretch = true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.viewport._contentWrapper.nativeElement.style.height).toBe(
      '100%',
    );
  });
});

@Component({
  template: `
    <cdk-virtual-scroll-viewport dynamicSize [sizes]="sizes" [stretch]="stretch"
        [style.height.px]="300" [style.width.px]="300">
      <div *cdkVirtualFor="let item of items" [style.height.px]="sizes[item]">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [CdkVirtualScrollViewport, CdkDynamicSizeVirtualScroll, CdkVirtualForOf],
})
class DynamicSizeDirectiveHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport!: CdkVirtualScrollViewport;
  @ViewChild(CdkDynamicSizeVirtualScroll, {static: true}) dynamicSize!: CdkDynamicSizeVirtualScroll;
  items = [0, 1, 2];
  sizes = [40, 80, 140];
  stretch = false;
}
