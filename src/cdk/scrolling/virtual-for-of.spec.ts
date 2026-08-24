import {RecycleViewElementsState} from '../collections/recycle-view-elements-state.service';
import {CdkVirtualForOf, CdkVirtualScrollViewport, ScrollingModule} from './index';
import {Component, TrackByFunction, ViewChild, ViewEncapsulation} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {dispatchFakeEvent} from '../testing/private';

@Component({
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
  providers: [RecycleViewElementsState],
  styles: `
    .cdk-virtual-scroll-content-wrapper { display: flex; flex-direction: column; }
    .cdk-virtual-scroll-viewport { width: 200px; height: 200px; }
    .item { height: 50px; box-sizing: border-box; }
  `,
  template: `
    <cdk-virtual-scroll-viewport itemSize="50">
      <div
        class="item"
        *cdkVirtualFor="
          let item of items;
          trackBy: trackBy;
          storeScrollPosition: storeScroll;
          collectDetached: collectKey;
          id: contextId;
          repeaterId: repeaterKey;
          groupId: groupKey;
          templateCacheSize: 0
        "
      >
        {{item.label}}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
})
class ForkInputHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport!: CdkVirtualScrollViewport;
  @ViewChild(CdkVirtualForOf, {static: true}) virtualFor!: CdkVirtualForOf<{
    key: string;
    label: string;
  }>;
  items = [
    {key: 'row-0', label: 'zero'},
    {key: 'row-1', label: 'one'},
    {key: 'row-2', label: 'two'},
    {key: 'row-3', label: 'three'},
    {key: 'row-4', label: 'four'},
    {key: 'row-5', label: 'five'},
  ];
  trackBy: TrackByFunction<{key: string; label: string}> = (_index, item) => item.key;
  storeScroll = true;
  collectKey: string | null = 'group-1';
  contextId: unknown = 'context-a';
  repeaterKey: string | null = 'repeater-1';
  groupKey: string | null = 'group-1';
}

@Component({
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
  styles: `
    .outer, .inner { width: 200px; }
    .outer { height: 200px; }
    .inner { height: 100px; }
    .group, .child { box-sizing: border-box; }
    .group { height: 100px; }
    .child { height: 50px; }
  `,
  template: `
    <cdk-virtual-scroll-viewport class="outer" itemSize="100">
      <div class="group" *cdkVirtualFor="let group of groups; trackBy: trackGroup">
        <cdk-virtual-scroll-viewport class="inner" itemSize="50">
          <div class="child" *cdkVirtualFor="let child of group.children; trackBy: trackChild">
            {{child}}
          </div>
        </cdk-virtual-scroll-viewport>
      </div>
    </cdk-virtual-scroll-viewport>
  `,
})
class NestedViewportHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) outerViewport!: CdkVirtualScrollViewport;
  groups = [
    {key: 'g0', children: ['a0', 'a1', 'a2', 'a3']},
    {key: 'g1', children: ['b0', 'b1']},
  ];
  trackGroup: TrackByFunction<{key: string}> = (_index, group) => group.key;
  trackChild: TrackByFunction<string> = (_index, child) => child;
}

@Component({
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
  template: `
    <cdk-virtual-scroll-viewport itemSize="50" style="height:200px;width:200px">
      <div *cdkVirtualFor="let item of items; trackBy: trackBy" style="height:50px">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
})
class MissingProviderHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport!: CdkVirtualScrollViewport;
  items = ['a', 'b', 'c', 'd'];
  trackBy: TrackByFunction<string> = (_index, item) => item;
}

/** Finish initializing the virtual scroll component at the beginning of a test. */
function finishInit(fixture: ComponentFixture<unknown>) {
  // On the first cycle we render and measure the viewport.
  fixture.detectChanges();
  flush();

  // On the second cycle we render the items.
  fixture.detectChanges();
  flush();

  // Flush the initial fake scroll event.
  tick(16); // flush animation frame
  flush();
  fixture.detectChanges();
}

/** Trigger a scroll event on the viewport (optionally setting a new scroll offset). */
function triggerScroll(viewport: CdkVirtualScrollViewport, offset?: number) {
  if (offset !== undefined) {
    viewport.scrollToOffset(offset);
  }
  dispatchFakeEvent(viewport.scrollable!.getElementRef().nativeElement, 'scroll');
  tick(16); // flush animation frame
}

describe('CdkVirtualForOf fork inputs', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ForkInputHost, NestedViewportHost, MissingProviderHost],
    });
  }));

  it('forwards storeScrollPosition, collectDetached, repeaterId, and groupId to the repeater', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForkInputHost);
    finishInit(fixture);
    const virtualFor = fixture.componentInstance.virtualFor;

    expect(virtualFor.cdkVirtualForStoreScrollPosition).toBe(true);
    expect(virtualFor.cdkVirtualForCollectDetached).toBe('group-1');
    expect(virtualFor.cdkVirtualForRepeaterId).toBe('repeater-1');
    expect(virtualFor.cdkVirtualForGroupId).toBe('group-1');
    expect(virtualFor.cdkVirtualForId).toBe('context-a');
    flush();
  }));

  it('copies cdkVirtualForId onto each rendered context and does not use it as a retain key', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForkInputHost);
    const stateService = fixture.debugElement.injector.get(RecycleViewElementsState);
    finishInit(fixture);
    fixture.componentInstance.contextId = 'context-b';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();
    const renderedView = (
      fixture.componentInstance.virtualFor as unknown as {
        _viewContainerRef: {get(index: number): {context: {cdkVirtualForId: unknown}}};
      }
    )._viewContainerRef.get(0);
    expect(renderedView.context.cdkVirtualForId).toBe('context-b');
    expect(stateService.getDetachedIds()).toEqual([]);
    flush();
  }));

  it('binds each *cdkVirtualFor to the nearest viewport, not an ancestor', fakeAsync(() => {
    const fixture = TestBed.createComponent(NestedViewportHost);
    finishInit(fixture);
    finishInit(fixture);
    const outerRange = fixture.componentInstance.outerViewport.getRenderedRange();
    expect(outerRange).toEqual({start: 0, end: 2});
    const innerText = Array.from(
      fixture.nativeElement.querySelectorAll('.inner .child') as NodeListOf<HTMLElement>,
    ).map(node => node.textContent?.trim());
    expect(innerText).toEqual(['a0', 'a1', 'a2', 'a3', 'b0', 'b1']);
    flush();
  }));

  it('compacts nullish full-data trackBy ids so later realIndex can shift', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForkInputHost);
    fixture.componentInstance.trackBy = (indexValue, item) => (indexValue === 1 ? null : item.key);
    finishInit(fixture);
    const virtualFor = fixture.componentInstance.virtualFor as unknown as {
      _viewRepeater: {['_itemsTrackByIds']: string[]};
    };
    expect(virtualFor._viewRepeater['_itemsTrackByIds']).toEqual([
      'row-0',
      'row-2',
      'row-3',
      'row-4',
      'row-5',
    ]);
    flush();
  }));

  it('does not refresh track-by ids when trackBy is cleared, leaving the previous array', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForkInputHost);
    finishInit(fixture);
    const virtualFor = fixture.componentInstance.virtualFor as unknown as {
      _viewRepeater: {['_itemsTrackByIds']: string[]};
    };
    const previousIds = [...virtualFor._viewRepeater['_itemsTrackByIds']];
    fixture.componentInstance.trackBy = undefined as unknown as TrackByFunction<{
      key: string;
      label: string;
    }>;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();
    expect(virtualFor._viewRepeater['_itemsTrackByIds']).toEqual(previousIds);
    flush();
  }));

  it('replacing the data source rebuilds full-data trackBy ids', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForkInputHost);
    finishInit(fixture);
    fixture.componentInstance.items = [
      {key: 'next-0', label: 'n0'},
      {key: 'next-1', label: 'n1'},
    ];
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();
    const virtualFor = fixture.componentInstance.virtualFor as unknown as {
      _viewRepeater: {['_itemsTrackByIds']: string[]};
    };
    expect(virtualFor._viewRepeater['_itemsTrackByIds']).toEqual(['next-0', 'next-1']);
    flush();
  }));

  it('renders without RecycleViewElementsState and does not throw', fakeAsync(() => {
    const fixture = TestBed.createComponent(MissingProviderHost);
    finishInit(fixture);
    expect(fixture.componentInstance.viewport.getDataLength()).toBe(4);
    expect(fixture.nativeElement.textContent).toContain('a');
    flush();
  }));

  it('empty collectDetached string is forwarded as empty, not converted to null', fakeAsync(() => {
    const fixture = TestBed.createComponent(ForkInputHost);
    fixture.componentInstance.collectKey = '';
    finishInit(fixture);
    expect(fixture.componentInstance.virtualFor.cdkVirtualForCollectDetached).toBe('');
    flush();
  }));
});
