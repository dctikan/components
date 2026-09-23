import {EmbeddedViewRef} from '@angular/core';
import {RecycleViewElementsState} from './recycle-view-elements-state.service';

describe('RecycleViewElementsState retention', () => {
  let state: RecycleViewElementsState;

  beforeEach(() => (state = new RecycleViewElementsState()));
  afterEach(() => state.ngOnDestroy());

  it('keeps a marked retained view keyed by trackBy id until all owners release it', () => {
    const view = {destroy: jasmine.createSpy('destroy')} as unknown as EmbeddedViewRef<unknown>;
    state.detachChanges.subscribe(event => {
      if (event.type === 'mark' && event.id === 'cell') {
        state.retainDetachedView('cell', view, 'row', 'group');
      }
    });
    state.markForDetach('cell', 'editor');
    state.markForDetach('cell', 'pagination');

    expect(state.takeDetachedView('cell')).toEqual({view, repeaterId: 'row', groupId: 'group'});
    expect(state.takeDetachedView('cell')?.view).toBe(view);
    state.unmarkForDetach('cell', 'pagination');
    expect(state.takeDetachedView('cell')?.view).toBe(view);
    state.unmarkForDetach('cell', 'editor');
    expect(state.takeDetachedView('cell')).toBeNull();
    expect(view.destroy).not.toHaveBeenCalled();
  });

  it('collects and inserts by parent group key, and clears group and repeater entries', () => {
    const view = {destroy: jasmine.createSpy('destroy')} as unknown as EmbeddedViewRef<unknown>;
    const events: unknown[] = [];
    state.detachChanges.subscribe(event => events.push(event));
    state.markForDetach('cell');
    state.retainDetachedView('cell', view, 'row', 'group');
    state.collectDetachedViews('group');
    state.notifyInsert('group');
    expect(events).toEqual([
      {type: 'mark', id: 'cell'},
      {type: 'collect', collectDetached: 'group'},
      {type: 'insert', collectDetached: 'group'},
    ]);
    state.removeDetachedViewsByRepeaterId('other');
    expect(state.takeDetachedView('cell')?.view).toBe(view);
    state.removeDetachedViewsByGroupId('group');
    expect(state.takeDetachedView('cell')).toBeNull();
    expect(state.isMarkedForDetach('cell')).toBe(false);
    expect(view.destroy).not.toHaveBeenCalled();
  });

  it('merges keyed scroll state and destroys retained views on clear', () => {
    const view = {destroy: jasmine.createSpy('destroy')} as unknown as EmbeddedViewRef<unknown>;
    state.add('column', {scrollPosition: {scrollTop: 35, scrollLeft: 8}});
    state.add('column', {dragged: true});
    state.retainDetachedView('column', view);
    expect(state.get('column')).toEqual({
      scrollPosition: {scrollTop: 35, scrollLeft: 8},
      dragged: true,
    });
    state.clear();
    expect(state.get('column')).toBeUndefined();
    expect(view.destroy).toHaveBeenCalledTimes(1);
  });
});
