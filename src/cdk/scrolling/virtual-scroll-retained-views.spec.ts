import {
  RecycleViewDetachEvent,
  RecycleViewElementsState,
} from '../collections/recycle-view-elements-state.service';
import {CdkVirtualScrollViewport, ScrollingModule} from './index';
import {
  Component,
  Input,
  TrackByFunction,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {dispatchFakeEvent} from '../testing/private';

let nextInstanceSerial = 1;

@Component({
  selector: 'focusable-cell',
  standalone: true,
  template: `<div class="cell" [attr.data-serial]="instanceSerial">{{itemKey}}</div>`,
})
class FocusableCellComponent {
  @Input() itemKey = '';
  instanceSerial = nextInstanceSerial++;
  private readonly stateService = inject(RecycleViewElementsState);

  mark(): void {
    this.stateService.markForDetach(this.itemKey, 'cell-source');
  }
}

@Component({
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule, FocusableCellComponent],
  providers: [RecycleViewElementsState],
  styles: `
    .outer { width: 240px; height: 120px; }
    .inner { width: 240px; height: 80px; overflow: auto; }
    .group { height: 120px; box-sizing: border-box; }
    .child { height: 40px; box-sizing: border-box; }
  `,
  template: `
    <cdk-virtual-scroll-viewport
      class="outer"
      itemSize="120"
      minBufferPx="0"
      maxBufferPx="0"
      [disableAppending]="true"
    >
      <div
        class="group"
        *cdkVirtualFor="let group of groups; trackBy: trackGroup; templateCacheSize: 0"
      >
        <cdk-virtual-scroll-viewport
          class="inner cdk-virtual-scrollable"
          itemSize="40"
          cdkVirtualScrollingElement
        >
          <focusable-cell
            class="child"
            *cdkVirtualFor="
              let child of group.children;
              trackBy: trackChild;
              collectDetached: group.key;
              repeaterId: group.key;
              groupId: group.key;
              storeScrollPosition: true;
              templateCacheSize: 0
            "
            [itemKey]="child.key"
          ></focusable-cell>
        </cdk-virtual-scroll-viewport>
      </div>
    </cdk-virtual-scroll-viewport>
  `,
})
class ParentChildHost {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) outerViewport!: CdkVirtualScrollViewport;
  stateService = inject(RecycleViewElementsState);
  groups = [
    {key: 'group-0', children: [{key: 'cell-0'}, {key: 'cell-1'}, {key: 'cell-2'}]},
    {key: 'group-1', children: [{key: 'cell-3'}, {key: 'cell-4'}]},
    {key: 'group-2', children: [{key: 'cell-5'}]},
  ];
  trackGroup: TrackByFunction<{key: string}> = (_index, group) => group.key;
  trackChild: TrackByFunction<{key: string}> = (_index, child) => child.key;
}

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

function ownerKeysFrom(stateService: RecycleViewElementsState) {
  return stateService.getDetachedIds().map(detachedId => {
    const entry = stateService.takeDetachedView(detachedId);
    return {
      detachedId,
      repeaterId: entry?.repeaterId ?? null,
      groupId: entry?.groupId ?? null,
    };
  });
}

function isStrategyRestoreCallback(callback: FrameRequestCallback): boolean {
  const callbackSource = Function.prototype.toString.call(callback);
  return callbackSource.includes('scrollTop') && callbackSource.includes('scrollLeft');
}

function describeFailure(args: {
  events: RecycleViewDetachEvent[];
  originalSerial: number;
  restoredSerial?: number;
  host: ParentChildHost;
  innerViewport: HTMLElement | null;
  selectedScrollTarget: string | null;
  restoreScheduled: boolean;
}): string {
  return JSON.stringify({
    events: args.events,
    originalSerial: args.originalSerial,
    restoredSerial: args.restoredSerial,
    ownerKeys: ownerKeysFrom(args.host.stateService),
    renderedRange: args.host.outerViewport.getRenderedRange(),
    localIndex: 0,
    globalIndex: args.host.outerViewport.getRenderedRange().start,
    scrollOffset: args.host.outerViewport.measureScrollOffset(),
    innerScrollTop: args.innerViewport?.scrollTop ?? null,
    selectedScrollTarget: args.selectedScrollTarget,
    restoreScheduled: args.restoreScheduled,
  });
}

describe('retained view parent/child integration', () => {
  beforeEach(waitForAsync(() => {
    nextInstanceSerial = 1;
    TestBed.configureTestingModule({imports: [ParentChildHost]});
  }));

  it('keeps the focused child instance across parent recycle and restores independent inner offset', fakeAsync(() => {
    const fixture = TestBed.createComponent(ParentChildHost);
    const events: RecycleViewDetachEvent[] = [];
    const host = fixture.componentInstance;
    const eventSub = host.stateService.detachChanges.subscribe(event => events.push(event));
    finishInit(fixture);
    finishInit(fixture);

    const cellComponent = fixture.debugElement.query(debugEl => debugEl.name === 'focusable-cell')
      .componentInstance as FocusableCellComponent;
    const originalSerial = cellComponent.instanceSerial;
    cellComponent.mark();
    const innerViewport = fixture.nativeElement.querySelector('.inner') as HTMLElement;
    innerViewport.scrollTop = 40;
    fixture.detectChanges();

    const originalRaf = window.requestAnimationFrame;
    let restoreScheduled = false;
    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      if (isStrategyRestoreCallback(callback)) {
        restoreScheduled = true;
      }
      return originalRaf.call(window, callback);
    }) as typeof window.requestAnimationFrame;

    try {
      triggerScroll(host.outerViewport, 120);
      fixture.detectChanges();
      flush();

      const selectedScrollTarget = innerViewport.className;
      const scrolledRange = host.outerViewport.getRenderedRange();
      const failureAfterScroll = describeFailure({
        events,
        originalSerial,
        host,
        innerViewport,
        selectedScrollTarget,
        restoreScheduled,
      });
      expect(host.outerViewport.measureScrollOffset()).withContext(failureAfterScroll).toBe(120);
      expect(scrolledRange).withContext(failureAfterScroll).toEqual({start: 1, end: 2});
      expect(events.some(event => event.type === 'collect' && event.collectDetached === 'group-0'))
        .withContext(failureAfterScroll)
        .toBe(true);
      expect(events)
        .withContext(failureAfterScroll)
        .toEqual([
          {type: 'mark', id: 'cell-0'},
          {type: 'collect', collectDetached: 'group-0'},
        ]);
      expect(ownerKeysFrom(host.stateService))
        .withContext(failureAfterScroll)
        .toEqual([{detachedId: 'cell-0', repeaterId: 'group-0', groupId: 'group-0'}]);

      triggerScroll(host.outerViewport, 0);
      fixture.detectChanges();
      flush();
      tick(16);
      flush();

      const restoredInner = fixture.nativeElement.querySelector('.inner') as HTMLElement | null;
      const restoredCell = fixture.debugElement.query(debugEl => debugEl.name === 'focusable-cell')
        .componentInstance as FocusableCellComponent;
      const failureAfterRestore = describeFailure({
        events,
        originalSerial,
        restoredSerial: restoredCell.instanceSerial,
        host,
        innerViewport: restoredInner,
        selectedScrollTarget,
        restoreScheduled,
      });
      expect(restoredCell.instanceSerial).withContext(failureAfterRestore).toBe(originalSerial);
      expect(events.some(event => event.type === 'insert' && event.collectDetached === 'group-0'))
        .withContext(failureAfterRestore)
        .toBe(false);
      expect(events)
        .withContext(failureAfterRestore)
        .toEqual([
          {type: 'mark', id: 'cell-0'},
          {type: 'collect', collectDetached: 'group-0'},
          {type: 'collect', collectDetached: 'group-1'},
        ]);
      expect(restoredInner?.scrollTop).withContext(failureAfterRestore).toBe(0);
      expect(restoreScheduled).withContext(failureAfterRestore).toBe(false);

      host.stateService.removeDetachedViewsByGroupId('group-0');
      expect(host.stateService.takeDetachedView('cell-0'))
        .withContext(failureAfterRestore)
        .toBeNull();
    } finally {
      window.requestAnimationFrame = originalRaf;
      eventSub.unsubscribe();
      flush();
    }
  }));
});
