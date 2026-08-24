import {
  RecycleViewElementsState,
  _RecycleViewRepeaterStrategy,
} from './public-api';

describe('collections public-api fork exports', () => {
  it('exports RecycleViewElementsState', () => {
    expect(RecycleViewElementsState).toBeTruthy();
    const stateService = new RecycleViewElementsState();
    expect(stateService).toBeInstanceOf(RecycleViewElementsState);
  });

  it('exports _RecycleViewRepeaterStrategy', () => {
    expect(_RecycleViewRepeaterStrategy).toBeTruthy();
  });
});
