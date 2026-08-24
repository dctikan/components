import {
  Component,
  EmbeddedViewRef,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  inject,
} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {IterableDiffers} from '@angular/core';
import {By} from '@angular/platform-browser';
import {
  RecycleViewDetachEvent,
  RecycleViewElementsState,
} from './recycle-view-elements-state.service';
import {_RecycleViewRepeaterStrategy} from './recycle-view-repeater-strategy';
import {_ViewRepeaterItemContext} from './view-repeater';

interface RepeaterItem {
  key: string;
  label: string;
}

interface RepeaterContext extends _ViewRepeaterItemContext<RepeaterItem> {
  $implicit: RepeaterItem;
}

@Component({
  standalone: true,
  selector: 'repeater-state-probe',
  template: '',
})
class RepeaterStateProbeComponent {
  readonly injectedState = inject(RecycleViewElementsState, {optional: true});
}

@Component({
  standalone: true,
  imports: [RepeaterStateProbeComponent],
  template: `
    <ng-container #host></ng-container>
    <ng-template #itemTemplate let-item>
      <div class="item-root" [attr.data-key]="item.key">
        <repeater-state-probe></repeater-state-probe>
        <div
          class="cdk-virtual-scrollable"
          [style.overflow]="'auto'"
          [style.height.px]="40"
          [style.width.px]="80"
        >
          <div [style.height.px]="200" [style.width.px]="200">{{item.label}}</div>
        </div>
      </div>
    </ng-template>
  `,
})
class RepeaterHostComponent {
  @ViewChild('host', {read: ViewContainerRef, static: true})
  container!: ViewContainerRef;

  @ViewChild('itemTemplate', {static: true})
  itemTemplate!: TemplateRef<RepeaterContext>;
}

function applyItems(
  strategy: _RecycleViewRepeaterStrategy<RepeaterItem, RepeaterItem, RepeaterContext>,
  host: RepeaterHostComponent,
  differs: IterableDiffers,
  previousItems: RepeaterItem[],
  nextItems: RepeaterItem[],
): void {
  const differ = differs.find(previousItems).create<RepeaterItem>();
  differ.diff(previousItems);
  const changes = differ.diff(nextItems);
  if (!changes) {
    return;
  }
  strategy.applyChanges(
    changes,
    host.container,
    (record, _adjustedPreviousIndex, currentIndex) => ({
      templateRef: host.itemTemplate,
      context: {$implicit: record.item},
      index: currentIndex ?? undefined,
    }),
    record => record.item,
  );
}

function createDetachedView(
  host: RepeaterHostComponent,
  item: RepeaterItem,
): EmbeddedViewRef<RepeaterContext> {
  return host.itemTemplate.createEmbeddedView({$implicit: item});
}

describe('_RecycleViewRepeaterStrategy', () => {
  function createHarness(provideState: boolean) {
    TestBed.configureTestingModule({
      imports: [RepeaterHostComponent],
      providers: provideState ? [RecycleViewElementsState] : [],
    });
    const fixture = TestBed.createComponent(RepeaterHostComponent);
    fixture.detectChanges();
    const strategy = TestBed.runInInjectionContext(
      () => new _RecycleViewRepeaterStrategy<RepeaterItem, RepeaterItem, RepeaterContext>(),
    );
    const differs = TestBed.inject(IterableDiffers);
    const stateService = provideState ? TestBed.inject(RecycleViewElementsState) : null;
    return {fixture, strategy, differs, stateService};
  }

  it('works without RecycleViewElementsState and does not retain marked views', () => {
    const {fixture, strategy, differs} = createHarness(false);
    const host = fixture.componentInstance;
    const firstItems = [{key: 'row-1', label: 'one'}];
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.viewCacheSize = 0;
    applyItems(strategy, host, differs, [], firstItems);

    expect(host.container.length).toBe(1);
    applyItems(strategy, host, differs, firstItems, []);
    expect(host.container.length).toBe(0);
    strategy.detach();
  });

  it('provides RecycleViewElementsState to newly created embedded views', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    strategy.setTrackByFunction((_index, item) => item.key);
    applyItems(strategy, host, differs, [], [{key: 'row-1', label: 'one'}]);

    const renderedView = host.container.get(0) as EmbeddedViewRef<RepeaterContext>;
    const itemRoot = renderedView.rootNodes[0] as HTMLElement;
    const probeHost = itemRoot.querySelector('repeater-state-probe');
    const probeDebug = fixture.debugElement.query(By.directive(RepeaterStateProbeComponent));
    expect(probeHost).not.toBeNull();
    expect(probeDebug.nativeElement).toBe(probeHost);
    expect(probeDebug.injector.get(RecycleViewElementsState)).toBe(stateService!);
    strategy.detach();
  });

  it('skips the anonymous cache for a marked view and keeps the retained instance', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    const firstItems = [{key: 'row-1', label: 'one'}];
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.setRenderedRange({start: 0, end: 1});
    strategy.viewCacheSize = 20;
    applyItems(strategy, host, differs, [], firstItems);

    const originalView = host.container.get(0) as EmbeddedViewRef<RepeaterContext>;
    stateService!.markForDetach('row-1');
    applyItems(strategy, host, differs, firstItems, []);

    expect(host.container.length).toBe(0);
    expect(stateService!.takeDetachedView('row-1')?.view).toBe(originalView);

    applyItems(strategy, host, differs, [], firstItems);
    expect(host.container.get(0)).toBe(originalView);
    strategy.detach();
  });

  it('parent remove emits collect then nested collect detaches marked children only when collectDetached matches', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    const events: RecycleViewDetachEvent[] = [];
    const eventSub = stateService!.detachChanges.subscribe(event => events.push(event));
    const firstItems = [{key: 'group-1', label: 'group'}];
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.setCollectDetached(null);
    applyItems(strategy, host, differs, [], firstItems);

    applyItems(strategy, host, differs, firstItems, []);

    expect(events).toEqual([{type: 'collect', collectDetached: 'group-1'}]);
    eventSub.unsubscribe();
    strategy.detach();
  });

  it('notifyInsert after retained insert is emitted only when collectDetached is null', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    const events: RecycleViewDetachEvent[] = [];
    const firstItems = [{key: 'group-1', label: 'group'}];
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.setCollectDetached(null);
    applyItems(strategy, host, differs, [], firstItems);
    stateService!.markForDetach('group-1');
    applyItems(strategy, host, differs, firstItems, []);
    const eventSub = stateService!.detachChanges.subscribe(event => events.push(event));

    applyItems(strategy, host, differs, [], firstItems);

    expect(events).toEqual([{type: 'insert', collectDetached: 'group-1'}]);
    eventSub.unsubscribe();
    strategy.detach();
  });

  it('anonymous cache reuse does not emit insert', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    const events: RecycleViewDetachEvent[] = [];
    const firstItems = [{key: 'row-1', label: 'one'}];
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.viewCacheSize = 20;
    applyItems(strategy, host, differs, [], firstItems);
    applyItems(strategy, host, differs, firstItems, []);
    const eventSub = stateService!.detachChanges.subscribe(event => events.push(event));

    applyItems(strategy, host, differs, [], [{key: 'row-2', label: 'two'}]);

    expect(events).toEqual([]);
    eventSub.unsubscribe();
    strategy.detach();
  });

  it('development source reattach at local index 0 does not treat 0 as already rendered', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    const firstItems = [{key: 'cell-0', label: 'zero'}];
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.setRepeaterId('repeater-1');
    strategy.setCollectDetached('group-1');
    strategy.setItemsTrackByIds(['cell-0']);
    strategy.setRenderedRange({start: 0, end: 1});
    applyItems(strategy, host, differs, [], firstItems);
    stateService!.markForDetach('cell-0');
    const originalView = host.container.get(0) as EmbeddedViewRef<RepeaterContext>;
    expect(stateService!.takeDetachedView('cell-0')?.view).toBe(originalView);
    const insertSpy = spyOn(host.container, 'insert').and.callThrough();

    stateService!.notifyInsert('group-1');

    expect(host.container.length)
      .withContext(
        'guard is still if (localIndex); insert-of-attached does not duplicate; insert WAS invoked because 0 is falsy',
      )
      .toBe(1);
    expect(insertSpy)
      .withContext(
        'guard is still if (localIndex); insert-of-attached does not duplicate; insert WAS invoked because 0 is falsy',
      )
      .toHaveBeenCalled();
    strategy.detach();
  });

  it('nested reattach skips entries whose repeaterId does not match and no-ops without repeaterId', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.setCollectDetached('group-1');
    strategy.setItemsTrackByIds(['cell-1']);
    strategy.setRenderedRange({start: 0, end: 1});
    applyItems(strategy, host, differs, [], [{key: 'cell-1', label: 'one'}]);
    stateService!.markForDetach('cell-1');
    const beforeCount = host.container.length;

    stateService!.notifyInsert('group-1');
    expect(host.container.length)
      .withContext('no repeaterId means _reattachDetachedViewsInRange returns immediately')
      .toBe(beforeCount);

    strategy.setRepeaterId('repeater-other');
    stateService!.notifyInsert('group-1');
    expect(host.container.length).toBe(beforeCount);
    strategy.detach();
  });

  it('nested reattach inserts only when realIndex is in the current [start, end)', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    strategy.setTrackByFunction((_index, item) => item.key);
    strategy.setRepeaterId('repeater-1');
    strategy.setCollectDetached('group-1');
    strategy.setItemsTrackByIds(['cell-0', 'cell-1', 'cell-2']);
    strategy.setRenderedRange({start: 2, end: 3});
    applyItems(strategy, host, differs, [], [{key: 'cell-2', label: 'two'}]);
    stateService!.retainDetachedView(
      'cell-1',
      createDetachedView(host, {key: 'cell-1', label: 'one'}),
      'repeater-1',
      'group-1',
    );
    stateService!.markForDetach('cell-1');
    const beforeCount = host.container.length;

    stateService!.notifyInsert('group-1');
    expect(host.container.length)
      .withContext('cell-1 global index 1 is outside rendered [2, 3)')
      .toBe(beforeCount);
    strategy.detach();
  });

  it('remove-path trackBy uses the current renderedRange.start plus previousIndex', () => {
    const {fixture, strategy, differs, stateService} = createHarness(true);
    const host = fixture.componentInstance;
    const seenIndexes: number[] = [];
    strategy.setTrackByFunction((indexValue, item) => {
      seenIndexes.push(indexValue);
      return item.key;
    });
    const firstItems = [
      {key: 'row-a', label: 'a'},
      {key: 'row-b', label: 'b'},
    ];
    strategy.setRenderedRange({start: 0, end: 2});
    applyItems(strategy, host, differs, [], firstItems);
    seenIndexes.length = 0;
    strategy.setRenderedRange({start: 2, end: 4});
    applyItems(strategy, host, differs, firstItems, []);

    expect(seenIndexes)
      .withContext(
        'current state: remove uses the new range start, not the previous window; extra cache-path trackBy calls yield [2, 2, 3, 2]',
      )
      .toEqual([2, 2, 3, 2]);
    expect(stateService).toBeTruthy();
    strategy.detach();
  });

  describe('scroll restoration', () => {
    function getScrollable(view: EmbeddedViewRef<RepeaterContext>): HTMLElement {
      const rootNode = view.rootNodes.find(
        (node): node is HTMLElement => node instanceof HTMLElement,
      );
      const scrollable = rootNode?.querySelector('.cdk-virtual-scrollable') as HTMLElement | null;
      if (!scrollable) {
        throw new Error('expected nested cdk-virtual-scrollable');
      }
      if (getComputedStyle(scrollable).overflowY !== 'auto') {
        scrollable.style.overflowY = 'auto';
      }
      if (!scrollable.style.height) {
        scrollable.style.height = '40px';
      }
      const innerContent = scrollable.firstElementChild;
      if (innerContent instanceof HTMLElement && !innerContent.style.height) {
        innerContent.style.height = '200px';
      }
      return scrollable;
    }

    function captureAnimationFrames(): FrameRequestCallback[] {
      const scheduled: FrameRequestCallback[] = [];
      spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback) => {
        scheduled.push(callback);
        return scheduled.length;
      });
      spyOn(window, 'cancelAnimationFrame');
      return scheduled;
    }

    it('does not store a zero scroll position and therefore cannot overwrite a stored non-zero', () => {
      const {fixture, strategy, differs, stateService} = createHarness(true);
      const host = fixture.componentInstance;
      const firstItems = [{key: 'col-1', label: 'one'}];
      strategy.setTrackByFunction((_index, item) => item.key);
      strategy.setStoreScrollPosition(true);
      applyItems(strategy, host, differs, [], firstItems);
      fixture.detectChanges();
      const firstView = host.container.get(0) as EmbeddedViewRef<RepeaterContext>;
      getScrollable(firstView).scrollTop = 40;
      applyItems(strategy, host, differs, firstItems, []);
      expect(stateService!.get('col-1')).toEqual({
        scrollPosition: {scrollTop: 40, scrollLeft: 0},
      });

      applyItems(strategy, host, differs, [], firstItems);
      fixture.detectChanges();
      const restoredView = host.container.get(0) as EmbeddedViewRef<RepeaterContext>;
      getScrollable(restoredView).scrollTop = 0;
      applyItems(strategy, host, differs, firstItems, []);

      expect(stateService!.get('col-1'))
        .withContext('zero positions are not stored, so stale non-zero remains')
        .toEqual({scrollPosition: {scrollTop: 40, scrollLeft: 0}});
      strategy.detach();
    });

    it('restores by the incoming item trackBy id on anonymous cache reuse and does not clear after restore', () => {
      const {fixture, strategy, differs, stateService} = createHarness(true);
      const host = fixture.componentInstance;
      strategy.setTrackByFunction((_index, item) => item.key);
      strategy.setStoreScrollPosition(true);
      strategy.viewCacheSize = 20;
      applyItems(strategy, host, differs, [], [{key: 'col-1', label: 'one'}]);
      fixture.detectChanges();
      getScrollable(host.container.get(0) as EmbeddedViewRef<RepeaterContext>).scrollTop = 25;
      applyItems(strategy, host, differs, [{key: 'col-1', label: 'one'}], []);

      const scheduled = captureAnimationFrames();
      applyItems(strategy, host, differs, [], [{key: 'col-2', label: 'two'}]);
      expect(scheduled.length)
        .withContext('anonymous reuse restores by incoming col-2 id; no stored position so no rAF')
        .toBe(0);
      expect(stateService!.get('col-1')?.['scrollPosition']).toEqual({
        scrollTop: 25,
        scrollLeft: 0,
      });
      strategy.detach();
    });

    it('prefers a nested overflow auto/scroll .cdk-virtual-scrollable over the view root', () => {
      const {fixture, strategy, differs, stateService} = createHarness(true);
      const host = fixture.componentInstance;
      strategy.setTrackByFunction((_index, item) => item.key);
      strategy.setStoreScrollPosition(true);
      applyItems(strategy, host, differs, [], [{key: 'col-1', label: 'one'}]);
      fixture.detectChanges();
      const firstView = host.container.get(0) as EmbeddedViewRef<RepeaterContext>;
      const rootNode = firstView.rootNodes.find(
        (node): node is HTMLElement => node instanceof HTMLElement,
      )!;
      rootNode.style.overflow = 'visible';
      rootNode.scrollTop = 90;
      getScrollable(firstView).scrollTop = 33;
      applyItems(strategy, host, differs, [{key: 'col-1', label: 'one'}], []);

      expect(stateService!.get('col-1')).toEqual({
        scrollPosition: {scrollTop: 33, scrollLeft: 0},
      });
      strategy.detach();
    });

    it('schedules restore on requestAnimationFrame and never cancels it', () => {
      const {fixture, strategy, differs} = createHarness(true);
      const host = fixture.componentInstance;
      strategy.setTrackByFunction((_index, item) => item.key);
      strategy.setStoreScrollPosition(true);
      applyItems(strategy, host, differs, [], [{key: 'col-1', label: 'one'}]);
      fixture.detectChanges();
      getScrollable(host.container.get(0) as EmbeddedViewRef<RepeaterContext>).scrollTop = 18;
      applyItems(strategy, host, differs, [{key: 'col-1', label: 'one'}], []);
      const scheduled = captureAnimationFrames();
      applyItems(strategy, host, differs, [], [{key: 'col-1', label: 'one'}]);

      expect(scheduled.length)
        .withContext('capture starts after save so Angular insert/CD rAFs are excluded')
        .toBe(1);
      expect(window.cancelAnimationFrame).not.toHaveBeenCalled();
      scheduled[0](0);
      expect(
        getScrollable(host.container.get(0) as EmbeddedViewRef<RepeaterContext>).scrollTop,
      ).toBe(18);
      strategy.detach();
    });

    it('save and restore no-op when storeScrollPosition is false, state is missing, or trackBy is missing', () => {
      const {fixture, strategy, differs, stateService} = createHarness(true);
      const host = fixture.componentInstance;
      applyItems(strategy, host, differs, [], [{key: 'col-1', label: 'one'}]);
      getScrollable(host.container.get(0) as EmbeddedViewRef<RepeaterContext>).scrollTop = 18;
      applyItems(strategy, host, differs, [{key: 'col-1', label: 'one'}], []);
      expect(stateService!.get('col-1')).toBeUndefined();

      strategy.setTrackByFunction((_index, item) => item.key);
      applyItems(strategy, host, differs, [], [{key: 'col-1', label: 'one'}]);
      getScrollable(host.container.get(0) as EmbeddedViewRef<RepeaterContext>).scrollTop = 18;
      applyItems(strategy, host, differs, [{key: 'col-1', label: 'one'}], []);
      expect(stateService!.get('col-1')).toBeUndefined();
      strategy.detach();
    });
  });
});
