import {Component, ViewChild} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {ScrollingModule} from './scrolling-module';
import {CdkVirtualScrollSticky} from './virtual-scroll-sticky.directive';

@Component({
  template: `<cdk-virtual-scroll-viewport cdkVirtualScrollSticky [itemSize]="50"
      style="height: 200px; width: 100px">
      <div *cdkVirtualFor="let item of items" style="height: 50px">{{item}}</div>
    </cdk-virtual-scroll-viewport>`,
  imports: [ScrollingModule],
})
class StickyHost {
  @ViewChild(CdkVirtualScrollSticky) sticky!: CdkVirtualScrollSticky;
  items = Array.from({length: 10}, (_, index) => index);
}

describe('CdkVirtualScrollSticky', () => {
  it('converts a vertical wrapper translation into top without creating a stacking context', async () => {
    const fixture = TestBed.createComponent(StickyHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const wrapper = fixture.nativeElement.querySelector(
      '.cdk-virtual-scroll-content-wrapper',
    ) as HTMLElement;
    wrapper.style.transform = 'translateY(100px)';
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(wrapper.style.top).toBe('100px');
    expect(wrapper.style.transform).toBe('none');
    fixture.destroy();
  });

  it('does not replace horizontal translation with a vertical offset', async () => {
    const fixture = TestBed.createComponent(StickyHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const wrapper = fixture.nativeElement.querySelector(
      '.cdk-virtual-scroll-content-wrapper',
    ) as HTMLElement;
    wrapper.style.transform = 'translateX(80px)';
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(wrapper.style.transform).toBe('translateX(80px)');
    expect(wrapper.style.top).toBe('');
    fixture.destroy();
  });

  it('does not repeat the historical stale-top defect when switching to horizontal translation', async () => {
    const fixture = TestBed.createComponent(StickyHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const wrapper = fixture.nativeElement.querySelector(
      '.cdk-virtual-scroll-content-wrapper',
    ) as HTMLElement;
    wrapper.style.transform = 'translateY(100px)';
    await new Promise(resolve => setTimeout(resolve, 0));
    wrapper.style.transform = 'translateX(80px)';
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(wrapper.style.top).toBe('');
    fixture.destroy();
  });
});
