import {RecycleViewElementsState, _RecycleViewRepeaterStrategy} from './public-api';

describe('collections public API fork exports', () => {
  it('exposes keyed view state to a consumer of the collections entry point', () => {
    const state = new RecycleViewElementsState();
    state.add('card', {expanded: true});
    expect(state.get('card')).toEqual({expanded: true});
    state.ngOnDestroy();
  });

  it('exports the keyed repeater implementation', () => {
    expect(_RecycleViewRepeaterStrategy).toBeDefined();
  });
});
