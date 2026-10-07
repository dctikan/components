import {Component, ViewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  CdkDynamicSizeVirtualScroll,
  CdkVisibleRange,
  CdkVirtualScrollSticky,
  ScrollingModule,
} from './public-api';

@Component({
  template: `
    <cdk-virtual-scroll-viewport [itemSize]="50" visibleRange cdkVirtualScrollSticky
      style="height: 200px; width: 100px"></cdk-virtual-scroll-viewport>
    <cdk-virtual-scroll-viewport dynamicSize [sizes]="[50]"
      style="height: 200px; width: 100px"></cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class ModuleHost {
  @ViewChild(CdkVisibleRange) visible!: CdkVisibleRange;
  @ViewChild(CdkVirtualScrollSticky) sticky!: CdkVirtualScrollSticky;
  @ViewChild(CdkDynamicSizeVirtualScroll) dynamic!: CdkDynamicSizeVirtualScroll;
}

describe('ScrollingModule public fork selectors', () => {
  it('makes sticky, preserved visibleRange and dynamicSize available to module consumers', () => {
    const fixture = TestBed.createComponent(ModuleHost);
    fixture.detectChanges();
    expect(fixture.componentInstance.visible).toBeInstanceOf(CdkVisibleRange);
    expect(fixture.componentInstance.sticky).toBeInstanceOf(CdkVirtualScrollSticky);
    expect(fixture.componentInstance.dynamic).toBeInstanceOf(CdkDynamicSizeVirtualScroll);
    fixture.destroy();
  });
});
