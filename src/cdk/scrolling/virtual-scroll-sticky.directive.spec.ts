import {Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {CdkVirtualScrollSticky} from './virtual-scroll-sticky.directive';
import {CdkVirtualScrollViewport} from './virtual-scroll-viewport';
import {ScrollingModule} from './scrolling-module';
import {dispatchFakeEvent} from '../testing/private';

describe('CdkVirtualScrollSticky', () => {
  describe('with a real viewport', () => {
    let fixture: ComponentFixture<StickyViewportHost>;
    let testHost: StickyViewportHost;
    let viewport: CdkVirtualScrollViewport;

    beforeEach(waitForAsync(() => {
      TestBed.configureTestingModule({
        imports: [ScrollingModule, StickyViewportHost],
      });
    }));

    beforeEach(() => {
      fixture = TestBed.createComponent(StickyViewportHost);
      testHost = fixture.componentInstance;
      viewport = testHost.viewport;
    });

    function contentWrapper(): HTMLElement {
      return viewport.elementRef.nativeElement.querySelector(
        '.cdk-virtual-scroll-content-wrapper',
      ) as HTMLElement;
    }

    it('converts an initial translateY(px) into top and transform none', fakeAsync(() => {
      finishInit(fixture);
      triggerScroll(viewport, 150);
      fixture.detectChanges();
      flush();
      tick(16);
      flush();

      const wrapper = contentWrapper();
      expect(wrapper.style.transform).toBe('none');
      expect(wrapper.style.top).toMatch(/^-?\d+(\.\d+)?px$/);
    }));

    it('converts a later observed translateY mutation', fakeAsync(() => {
      finishInit(fixture);
      const wrapper = contentWrapper();
      wrapper.style.transform = 'translateY(-80px)';
      tick(16);
      flush();

      expect(wrapper.style.transform).toBe('none');
      expect(wrapper.style.top).toBe('-80px');
    }));

    it('parses fractional and negative translateY values', fakeAsync(() => {
      finishInit(fixture);
      const wrapper = contentWrapper();
      wrapper.style.transform = 'translateY(-12.5px)';
      tick(16);
      flush();

      expect(wrapper.style.top).toBe('-12.5px');
    }));

    it('does not loop when the observer writes transform none', fakeAsync(() => {
      finishInit(fixture);
      const wrapper = contentWrapper();
      wrapper.style.transform = 'translateY(20px)';
      tick(16);
      flush();
      wrapper.style.transform = 'translateY(20px)';
      tick(16);
      flush();

      expect(wrapper.style.transform).toBe('none');
      expect(wrapper.style.top).toBe('20px');
    }));

    it('drops a compound transform after extracting translateY', fakeAsync(() => {
      finishInit(fixture);
      const wrapper = contentWrapper();
      wrapper.style.transform = 'translateY(10px) scale(1)';
      tick(16);
      flush();

      expect(wrapper.style.transform).toBe('none');
      expect(wrapper.style.top).toBe('10px');
    }));

    it('does not convert translateX used by horizontal orientation', fakeAsync(() => {
      testHost.orientation = 'horizontal';
      finishInit(fixture);
      triggerScroll(viewport, 150);
      fixture.detectChanges();
      flush();
      tick(16);
      flush();

      const wrapper = contentWrapper();
      expect(wrapper.style.transform).toContain('translateX');
      expect(wrapper.style.top).toBe('');
    }));

    it('leaves a stale top when orientation changes from vertical to horizontal', fakeAsync(() => {
      finishInit(fixture);
      triggerScroll(viewport, 150);
      fixture.detectChanges();
      flush();
      const verticalTop = contentWrapper().style.top;
      expect(verticalTop).not.toBe('');

      testHost.orientation = 'horizontal';
      fixture.changeDetectorRef.markForCheck();
      fixture.detectChanges();
      flush();
      triggerScroll(viewport, 150);
      fixture.detectChanges();
      flush();

      expect(contentWrapper().style.top)
        .withContext('current implementation never clears top on orientation change')
        .toBe(verticalTop);
    }));

    it('disconnects the observer on destroy so later style writes are ignored', fakeAsync(() => {
      finishInit(fixture);
      const wrapper = contentWrapper();
      fixture.destroy();
      wrapper.style.transform = 'translateY(40px)';
      tick(16);
      flush();

      expect(wrapper.style.transform).toBe('translateY(40px)');
    }));
  });

  describe('module import and missing wrapper', () => {
    it('applies through ScrollingModule without a standalone sticky import on the host', fakeAsync(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ModuleOnlyStickyHost],
      });
      const fixture = TestBed.createComponent(ModuleOnlyStickyHost);
      finishInit(fixture);
      const wrapper = fixture.componentInstance.viewport.elementRef.nativeElement.querySelector(
        '.cdk-virtual-scroll-content-wrapper',
      ) as HTMLElement;
      wrapper.style.transform = 'translateY(8px)';
      tick(16);
      flush();
      expect(wrapper.style.top).toBe('8px');
    }));

    it('no-ops when the content wrapper is missing', fakeAsync(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [MissingWrapperHost],
      });
      expect(() => {
        const fixture = TestBed.createComponent(MissingWrapperHost);
        fixture.detectChanges();
        flush();
        fixture.destroy();
      }).not.toThrow();
    }));

    // Directive has no Platform guard; MutationObserver delete is the only absence path.
    it('throws during AfterViewInit when MutationObserver is absent', fakeAsync(() => {
      const originalObserver = globalThis.MutationObserver;
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ScrollingModule, StickyViewportHost],
      });
      (globalThis as {MutationObserver?: typeof MutationObserver}).MutationObserver = undefined;

      expect(() => {
        const fixture = TestBed.createComponent(StickyViewportHost);
        fixture.detectChanges();
        flush();
      }).toThrow();

      globalThis.MutationObserver = originalObserver;
    }));
  });

  describe('browser layout', () => {
    it('keeps a sticky descendant at the viewport top after scroll when contain is none', fakeAsync(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [ScrollingModule, StickyLayoutHost],
      });
      const fixture = TestBed.createComponent(StickyLayoutHost);
      finishInit(fixture);
      const viewportElement = fixture.componentInstance.viewport.elementRef.nativeElement;
      const stickyHeader = viewportElement.querySelector('.sticky-header') as HTMLElement;
      triggerScroll(fixture.componentInstance.viewport, 120);
      fixture.detectChanges();
      flush();
      tick(16);
      flush();

      const viewportRect = viewportElement.getBoundingClientRect();
      const headerRect = stickyHeader.getBoundingClientRect();
      expect(viewportRect.height)
        .withContext(`viewportRect=${JSON.stringify(viewportRect.toJSON?.() ?? viewportRect)}`)
        .toBeGreaterThan(0);
      expect(headerRect.height)
        .withContext(`headerRect=${JSON.stringify(headerRect.toJSON?.() ?? headerRect)}`)
        .toBeGreaterThan(0);
      expect(Math.abs(headerRect.top - viewportRect.top))
        .withContext(
          `viewportTop=${viewportRect.top} headerTop=${headerRect.top} transform=${
            (viewportElement.querySelector('.cdk-virtual-scroll-content-wrapper') as HTMLElement)
              .style.transform
          }`,
        )
        .toBeLessThan(2);
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

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        cdkVirtualScrollSticky
        [itemSize]="50"
        [minBufferPx]="0"
        [maxBufferPx]="0"
        [disableAppending]="true"
        [orientation]="orientation"
        [style.height.px]="200"
        [style.width.px]="200">
      <div class="item" *cdkVirtualFor="let item of items; templateCacheSize: 0"
           [style.height.px]="50" [style.width.px]="50">
        {{item}}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; }
    .cdk-virtual-scroll-orientation-horizontal .cdk-virtual-scroll-content-wrapper {
      flex-direction: row;
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
})
class StickyViewportHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport: CdkVirtualScrollViewport;
  orientation: 'vertical' | 'horizontal' = 'vertical';
  items = Array.from({length: 20}, (_, itemIndex) => itemIndex);
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        cdkVirtualScrollSticky
        [itemSize]="50"
        [disableAppending]="true"
        [style.height.px]="200"
        [style.width.px]="200">
      <div class="item" *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class ModuleOnlyStickyHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport: CdkVirtualScrollViewport;
  items = Array.from({length: 10}, (_, itemIndex) => itemIndex);
}

@Component({
  template: `<div class="not-a-wrapper"></div>`,
  hostDirectives: [CdkVirtualScrollSticky],
})
class MissingWrapperHost {}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        class="layout-viewport"
        cdkVirtualScrollSticky
        [itemSize]="50"
        [minBufferPx]="0"
        [maxBufferPx]="0"
        [disableAppending]="true"
        [style.height.px]="200"
        [style.width.px]="200">
      <div class="item" *cdkVirtualFor="let item of items; templateCacheSize: 0"
           [style.height.px]="50">
        <div class="sticky-header">H{{item}}</div>
        <div>body {{item}}</div>
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .layout-viewport,
    .cdk-virtual-scrollable { contain: none; overflow: auto; }
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; contain: none; }
    .sticky-header {
      position: sticky;
      top: 0;
      height: 20px;
      background: red;
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
})
class StickyLayoutHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport: CdkVirtualScrollViewport;
  items = Array.from({length: 20}, (_, itemIndex) => itemIndex);
}
