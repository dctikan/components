import {RecycleViewElementsState, _RecycleViewRepeaterStrategy} from './public-api';
import * as collectionsPublicApi from './public-api';

describe('collections public-api fork exports', () => {
  it('exports RecycleViewElementsState', () => {
    expect(RecycleViewElementsState).toBeTruthy();
    const stateService = new RecycleViewElementsState();
    expect(stateService).toBeInstanceOf(RecycleViewElementsState);
  });

  it('exports _RecycleViewRepeaterStrategy', () => {
    expect(_RecycleViewRepeaterStrategy).toBeTruthy();
  });

  it('does not export a runtime RecycleViewDetachEvent value; it is a type-only public-api re-export', () => {
    expect('RecycleViewDetachEvent' in collectionsPublicApi).toBe(false);
  });
});
