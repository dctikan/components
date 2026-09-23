import {
  Component,
  EmbeddedViewRef,
  IterableDiffers,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {RecycleViewElementsState} from './recycle-view-elements-state.service';
import {_RecycleViewRepeaterStrategy} from './recycle-view-repeater-strategy';

type Item = {key: string};
type Context = {$implicit: Item};

@Component({
  template:
    '<ng-container #host></ng-container><ng-template #item let-item><div class="root"><div class="cdk-virtual-scrollable" style="overflow: auto">{{item.key}}</div></div></ng-template>',
})
class Host {
  @ViewChild('host', {read: ViewContainerRef, static: true}) container!: ViewContainerRef;
  @ViewChild('item', {static: true}) template!: TemplateRef<Context>;
}

describe('_RecycleViewRepeaterStrategy keyed behavior', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;
  let state: RecycleViewElementsState;
  let strategy: _RecycleViewRepeaterStrategy<Item, Item, Context>;
  let differs: IterableDiffers;

  beforeEach(() => {
    TestBed.configureTestingModule({imports: [Host], providers: [RecycleViewElementsState]});
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    state = TestBed.inject(RecycleViewElementsState);
    differs = TestBed.inject(IterableDiffers);
    strategy = TestBed.runInInjectionContext(
      () => new _RecycleViewRepeaterStrategy<Item, Item, Context>(),
    );
    strategy.setTrackByFunction((_index, item) => item.key);
  });
  afterEach(() => strategy.detach());

  function apply(previous: Item[], next: Item[]) {
    const differ = differs.find(previous).create<Item>();
    differ.diff(previous);
    const changes = differ.diff(next);
    if (changes) {
      strategy.applyChanges(
        changes,
        fixture.componentInstance.container,
        (record, _previousIndex, currentIndex) => ({
          templateRef: fixture.componentInstance.template,
          context: {$implicit: record.item},
          index: currentIndex!,
        }),
        record => record.item,
      );
    }
  }

  it('retains and reinserts the same marked view even with anonymous cache disabled', () => {
    const item = {key: 'cell'};
    strategy.viewCacheSize = 0;
    strategy.setRenderedRange({start: 4, end: 5});
    apply([], [item]);
    const original = fixture.componentInstance.container.get(0) as EmbeddedViewRef<Context>;
    state.markForDetach('cell');
    apply([item], []);
    expect(state.takeDetachedView('cell')?.view).toBe(original!);
    apply([], [item]);
    expect(fixture.componentInstance.container.get(0)).toBe(original);
  });

  it('retains a view marked before its first render when it leaves the window', () => {
    const item = {key: 'cell'};
    strategy.viewCacheSize = 0;
    state.markForDetach('cell', 'editor');
    apply([], [item]);
    const view = fixture.componentInstance.container.get(0) as EmbeddedViewRef<Context>;
    const destroy = spyOn(view, 'destroy').and.callThrough();

    apply([item], []);
    expect(state.takeDetachedView('cell')?.view).toBe(view);
    expect(destroy).not.toHaveBeenCalled();
    apply([], [item]);
    expect(fixture.componentInstance.container.get(0)).toBe(view);
    apply([item], []);
    state.clear();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('collects marked nested views and reinserts them in global index order for a matching parent group', () => {
    const items = [{key: 'first'}, {key: 'second'}];
    strategy.setCollectDetached('group');
    strategy.setRepeaterId('row');
    strategy.setGroupId('group');
    strategy.setItemsTrackByIds(['first', 'second']);
    strategy.setRenderedRange({start: 0, end: 2});
    apply([], items);
    const first = fixture.componentInstance.container.get(0);
    const second = fixture.componentInstance.container.get(1);
    state.markForDetach('second');
    state.markForDetach('first');
    state.collectDetachedViews('unrelated');
    expect(fixture.componentInstance.container.length).toBe(2);
    state.collectDetachedViews('group');
    expect(fixture.componentInstance.container.length).toBe(0);
    state.notifyInsert('group');
    expect(fixture.componentInstance.container.get(0)).toBe(first);
    expect(fixture.componentInstance.container.get(1)).toBe(second);
    state.notifyInsert('group');
    expect(fixture.componentInstance.container.length).toBe(2);
  });

  it('does not reattach another repeater or an item outside the rendered range', () => {
    strategy.setCollectDetached('group');
    strategy.setRepeaterId('row');
    strategy.setItemsTrackByIds(['outside', 'inside']);
    strategy.setRenderedRange({start: 1, end: 2});
    state.markForDetach('outside');
    state.markForDetach('inside');
    apply([], [{key: 'inside'}]);
    const outside = fixture.componentInstance.template.createEmbeddedView({
      $implicit: {key: 'outside'},
    });
    const otherRepeater = fixture.componentInstance.template.createEmbeddedView({
      $implicit: {key: 'inside'},
    });
    state.retainDetachedView('outside', outside, 'row', 'group');
    state.retainDetachedView('inside', otherRepeater, 'other-row', 'group');

    state.notifyInsert('group');

    expect(fixture.componentInstance.container.length).toBe(1);
    expect(fixture.componentInstance.container.get(0)).not.toBe(outside);
    expect(fixture.componentInstance.container.get(0)).not.toBe(otherRepeater);
  });

  it('stores nested scroll position on detach and restores it for the incoming key', () => {
    const item = {key: 'column'};
    strategy.setStoreScrollPosition(true);
    apply([], [item]);
    const view = fixture.componentInstance.container.get(0) as EmbeddedViewRef<Context>;
    const scrollable = (view.rootNodes[0] as HTMLElement).querySelector(
      '.cdk-virtual-scrollable',
    ) as HTMLElement;
    scrollable.scrollTop = 42;
    apply([item], []);
    expect(state.get('column')).toEqual({scrollPosition: {scrollTop: 42, scrollLeft: 0}});
    const callbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake(
      callback => (callbacks.push(callback), callbacks.length),
    );
    apply([], [item]);
    scrollable.scrollTop = 0;
    callbacks.forEach(callback => callback(0));
    expect(scrollable.scrollTop).toBe(42);
  });

  it('clears an anonymous cached view offset when the incoming key has no saved position', () => {
    const previous = {key: 'previous'};
    const incoming = {key: 'incoming'};
    strategy.setStoreScrollPosition(true);
    apply([], [previous]);
    const view = fixture.componentInstance.container.get(0) as EmbeddedViewRef<Context>;
    const scrollable = (view.rootNodes[0] as HTMLElement).querySelector(
      '.cdk-virtual-scrollable',
    ) as HTMLElement;
    scrollable.scrollTop = 42;
    scrollable.scrollLeft = 13;
    apply([previous], []);

    const callbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake(
      callback => (callbacks.push(callback), callbacks.length),
    );
    apply([], [incoming]);
    expect(fixture.componentInstance.container.get(0)).toBe(view);
    callbacks.forEach(callback => callback(0));

    expect(scrollable.scrollTop).toBe(0);
    expect(scrollable.scrollLeft).toBe(0);
    expect(state.get('previous')).toEqual({scrollPosition: {scrollTop: 42, scrollLeft: 13}});
  });

  it('does not restore an old key after its view is anonymously reused for another key', () => {
    const first = {key: 'first'};
    const second = {key: 'second'};
    strategy.setStoreScrollPosition(true);
    state.add('first', {scrollPosition: {scrollTop: 42, scrollLeft: 13}});
    const callbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake(
      callback => (callbacks.push(callback), callbacks.length),
    );

    apply([], [first]);
    const view = fixture.componentInstance.container.get(0) as EmbeddedViewRef<Context>;
    const scrollable = (view.rootNodes[0] as HTMLElement).querySelector(
      '.cdk-virtual-scrollable',
    ) as HTMLElement;
    apply([first], []);
    apply([], [second]);
    expect(fixture.componentInstance.container.get(0)).toBe(view);
    expect(view.context.$implicit).toBe(second);

    callbacks.forEach(callback => callback(0));
    expect(scrollable.scrollTop).toBe(0);
    expect(scrollable.scrollLeft).toBe(0);
  });

  it('prefers the nested overflow scrollable to the view root and restores both axes', () => {
    const item = {key: 'nested'};
    strategy.setStoreScrollPosition(true);
    apply([], [item]);
    const view = fixture.componentInstance.container.get(0) as EmbeddedViewRef<Context>;
    const root = view.rootNodes[0] as HTMLElement;
    const nested = root.querySelector('.cdk-virtual-scrollable') as HTMLElement;
    root.scrollTop = 99;
    nested.scrollTop = 42;
    nested.scrollLeft = 13;
    apply([item], []);
    expect(state.get('nested')).toEqual({scrollPosition: {scrollTop: 42, scrollLeft: 13}});

    const callbacks: FrameRequestCallback[] = [];
    spyOn(window, 'requestAnimationFrame').and.callFake(
      callback => (callbacks.push(callback), callbacks.length),
    );
    apply([], [item]);
    nested.scrollTop = 0;
    nested.scrollLeft = 0;
    callbacks.forEach(callback => callback(0));
    expect(nested.scrollTop).toBe(42);
    expect(nested.scrollLeft).toBe(13);
  });
});
