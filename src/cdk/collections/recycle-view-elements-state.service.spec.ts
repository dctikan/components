import {EmbeddedViewRef} from '@angular/core';
import {
  RecycleViewDetachEvent,
  RecycleViewElementsState,
} from './recycle-view-elements-state.service';

interface FakeViewRef {
  destroy: jasmine.Spy;
}

function createFakeView(label: string): EmbeddedViewRef<unknown> {
  const fakeView: FakeViewRef = {
    destroy: jasmine.createSpy(`${label}Destroy`),
  };
  return fakeView as unknown as EmbeddedViewRef<unknown>;
}

describe('RecycleViewElementsState', () => {
  let stateService: RecycleViewElementsState;

  beforeEach(() => {
    stateService = new RecycleViewElementsState();
  });

  afterEach(() => {
    stateService.ngOnDestroy();
  });

  describe('keyed state', () => {
    it('merges add() into the existing record and overwrites colliding keys', () => {
      stateService.add('card-1', {dragged: true});
      stateService.add('card-1', {dragged: false, offset: 12});

      expect(stateService.get('card-1')).toEqual({dragged: false, offset: 12});
      expect(stateService.has('card-1')).toBe(true);
    });

    it('subscribe() emits the current value immediately and undefined after remove()', () => {
      const emissions: Array<Record<string, unknown> | undefined> = [];
      stateService.add('card-1', {dragged: true});

      const subscription = stateService.subscribe('card-1').subscribe(value => {
        emissions.push(value);
      });

      stateService.add('card-1', {offset: 4});
      const removed = stateService.remove('card-1');

      expect(removed).toBe(true);
      expect(emissions).toEqual([{dragged: true}, {dragged: true, offset: 4}, undefined]);
      expect(stateService.has('card-1')).toBe(false);
      subscription.unsubscribe();
    });

    it('remove() of a missing key returns false and still runs detach cleanup', () => {
      stateService.markForDetach('ghost-1');

      expect(stateService.remove('ghost-1')).toBe(false);
      expect(stateService.isMarkedForDetach('ghost-1')).toBe(false);
    });
  });

  describe('mark and source ownership', () => {
    it('emits mark once and ignores a second mark for the same id', () => {
      const events: RecycleViewDetachEvent[] = [];
      const subscription = stateService.detachChanges.subscribe(event => events.push(event));

      stateService.markForDetach('row-1');
      stateService.markForDetach('row-1');

      expect(stateService.isMarkedForDetach('row-1')).toBe(true);
      expect(stateService.getDetachedIds()).toEqual(['row-1']);
      expect(events).toEqual([{type: 'mark', id: 'row-1'}]);
      subscription.unsubscribe();
    });

    it('records sourceId only after a retained view exists or on the first synchronous mark', () => {
      stateService.markForDetach('row-1');
      stateService.markForDetach('row-1', 'cell-a');

      expect(stateService.isMarkedForDetach('row-1')).toBe(true);
      expect(stateService.takeDetachedView('row-1')).toBeNull();

      stateService.unmarkForDetach('row-1', 'cell-a');
      expect(stateService.isMarkedForDetach('row-1'))
        .withContext(
          'current state: sourceId with no retained view is dropped, so unmark(sourceId) returns without clearing the mark',
        )
        .toBe(true);
    });

    it('keeps a retained entry until every recorded sourceId is released', () => {
      const retainedView = createFakeView('owned');
      stateService.markForDetach('row-1', 'cell-a');
      stateService.retainDetachedView('row-1', retainedView, 'repeater-1', 'group-1');
      stateService.markForDetach('row-1', 'cell-b');

      stateService.unmarkForDetach('row-1', 'cell-a');
      expect(stateService.takeDetachedView('row-1')?.view).toBe(retainedView);
      expect(stateService.isMarkedForDetach('row-1')).toBe(true);

      stateService.unmarkForDetach('row-1', 'cell-b');
      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(stateService.isMarkedForDetach('row-1')).toBe(false);
      expect(retainedView.destroy).not.toHaveBeenCalled();
    });

    it('unmarkForDetach without sourceId deletes the registry entry and does not destroy the view', () => {
      const retainedView = createFakeView('unmarked');
      stateService.markForDetach('row-1');
      stateService.retainDetachedView('row-1', retainedView);

      stateService.unmarkForDetach('row-1');

      expect(stateService.isMarkedForDetach('row-1')).toBe(false);
      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(retainedView.destroy)
        .withContext('JSDoc claims destroy; current implementation does not')
        .not.toHaveBeenCalled();
    });
  });

  describe('retain, take, and cleanup', () => {
    it('takeDetachedView returns the entry and does not delete it', () => {
      const retainedView = createFakeView('taken');
      stateService.retainDetachedView('row-1', retainedView, 'repeater-1', 'group-1');

      const firstTake = stateService.takeDetachedView('row-1');
      const secondTake = stateService.takeDetachedView('row-1');

      expect(firstTake).toEqual({
        view: retainedView,
        repeaterId: 'repeater-1',
        groupId: 'group-1',
      });
      expect(secondTake?.view).toBe(retainedView);
      expect(retainedView.destroy).not.toHaveBeenCalled();
    });

    it('retainDetachedView destroys a different previous view and copies sourceIds', () => {
      const firstView = createFakeView('first');
      const secondView = createFakeView('second');
      stateService.markForDetach('row-1', 'cell-a');
      stateService.retainDetachedView('row-1', firstView, 'repeater-1', 'group-1');
      stateService.retainDetachedView('row-1', secondView, 'repeater-2', 'group-2');

      expect(firstView.destroy).toHaveBeenCalledTimes(1);
      expect(stateService.takeDetachedView('row-1')).toEqual({
        view: secondView,
        repeaterId: 'repeater-2',
        groupId: 'group-2',
      });

      stateService.unmarkForDetach('row-1', 'cell-a');
      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(secondView.destroy).not.toHaveBeenCalled();
    });

    it('removeDetachedViewsByGroupId matches entry.groupId or the trackBy key and does not destroy', () => {
      const groupView = createFakeView('group');
      const keyView = createFakeView('key');
      const otherView = createFakeView('other');
      stateService.markForDetach('row-1');
      stateService.markForDetach('group-1');
      stateService.markForDetach('row-2');
      stateService.retainDetachedView('row-1', groupView, 'repeater-1', 'group-1');
      stateService.retainDetachedView('group-1', keyView, 'repeater-1', 'other-group');
      stateService.retainDetachedView('row-2', otherView, 'repeater-1', 'keep-group');

      stateService.removeDetachedViewsByGroupId('group-1');

      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(stateService.takeDetachedView('group-1')).toBeNull();
      expect(stateService.takeDetachedView('row-2')?.view).toBe(otherView);
      expect(groupView.destroy).not.toHaveBeenCalled();
      expect(keyView.destroy).not.toHaveBeenCalled();
    });

    it('removeDetachedViewsByRepeaterId deletes matching entries without destroy', () => {
      const matchingView = createFakeView('matching');
      const otherView = createFakeView('kept');
      stateService.markForDetach('row-1');
      stateService.markForDetach('row-2');
      stateService.retainDetachedView('row-1', matchingView, 'repeater-1', 'group-1');
      stateService.retainDetachedView('row-2', otherView, 'repeater-2', 'group-1');

      stateService.removeDetachedViewsByRepeaterId('repeater-1');

      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(stateService.isMarkedForDetach('row-1')).toBe(false);
      expect(stateService.takeDetachedView('row-2')?.view).toBe(otherView);
      expect(matchingView.destroy).not.toHaveBeenCalled();
    });

    it('remove(trackById) also calls removeDetachedViewsByRepeaterId(trackById)', () => {
      const keyedView = createFakeView('keyed');
      const collidingView = createFakeView('colliding');
      stateService.add('row-1', {scrollPosition: {scrollTop: 20, scrollLeft: 0}});
      stateService.markForDetach('row-1');
      stateService.retainDetachedView('row-1', keyedView, 'repeater-1', 'group-1');
      stateService.markForDetach('cell-9');
      stateService.retainDetachedView('cell-9', collidingView, 'row-1', 'group-1');

      stateService.remove('row-1');

      expect(stateService.get('row-1')).toBeUndefined();
      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(stateService.takeDetachedView('cell-9'))
        .withContext(
          'remove(id) treats id as a repeaterId and drops entries owned by that repeater',
        )
        .toBeNull();
      expect(keyedView.destroy).not.toHaveBeenCalled();
      expect(collidingView.destroy).not.toHaveBeenCalled();
    });

    it('clear() destroys retained views, emits clear, and completes state subjects', () => {
      const retainedView = createFakeView('cleared');
      const events: RecycleViewDetachEvent[] = [];
      const states: Array<Record<string, unknown> | undefined> = [];
      stateService.add('card-1', {dragged: true});
      stateService.retainDetachedView('row-1', retainedView);
      const eventSub = stateService.detachChanges.subscribe(event => events.push(event));
      const stateSub = stateService.subscribe('card-1').subscribe(value => states.push(value));

      stateService.clear();

      expect(retainedView.destroy).toHaveBeenCalledTimes(1);
      expect(stateService.takeDetachedView('row-1')).toBeNull();
      expect(stateService.getDetachedIds()).toEqual([]);
      expect(events).toEqual([{type: 'clear'}]);
      expect(states[0]).toEqual({dragged: true});
      expect(stateService.has('card-1')).toBe(false);
      eventSub.unsubscribe();
      stateSub.unsubscribe();
    });

    it('ngOnDestroy calls clear then completes detachChanges', () => {
      const retainedView = createFakeView('destroyed');
      const events: Array<RecycleViewDetachEvent | 'completed'> = [];
      stateService.retainDetachedView('row-1', retainedView);
      const subscription = stateService.detachChanges.subscribe({
        next: event => events.push(event),
        complete: () => events.push('completed'),
      });

      stateService.ngOnDestroy();
      stateService.collectDetachedViews('group-1');

      expect(retainedView.destroy).toHaveBeenCalledTimes(1);
      expect(events).toEqual([{type: 'clear'}, 'completed']);
      subscription.unsubscribe();
    });
  });
});
