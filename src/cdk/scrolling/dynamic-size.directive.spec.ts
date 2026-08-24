import {Component, DebugElement, ViewChild, ViewEncapsulation} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {CdkDynamicSizeVirtualScroll} from './dynamic-size.directive';
import {CdkDynamicSizeVirtualScrollStrategy} from './dynamic-size-strategy';
import {ScrollingModule} from './scrolling-module';
import {VIRTUAL_SCROLL_STRATEGY} from './virtual-scroll-strategy';

describe('CdkDynamicSizeVirtualScroll', () => {
  let fixture: ComponentFixture<DynamicDirectiveHost>;
  let testHost: DynamicDirectiveHost;
  let dynamicSize: CdkDynamicSizeVirtualScroll;
  let viewportDebug: DebugElement;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ScrollingModule, DynamicDirectiveHost],
    });
  }));

  beforeEach(fakeAsync(() => {
    fixture = TestBed.createComponent(DynamicDirectiveHost);
    testHost = fixture.componentInstance;
    fixture.detectChanges();
    flush();
    fixture.detectChanges();
    flush();
    tick(16);
    dynamicSize = testHost.dynamicSize;
    viewportDebug = fixture.debugElement.children[0];
  }));

  it('provides the same strategy instance as VIRTUAL_SCROLL_STRATEGY', () => {
    const injectedStrategy = viewportDebug.injector.get(VIRTUAL_SCROLL_STRATEGY);
    expect(injectedStrategy).toBe(dynamicSize._scrollStrategy);
    expect(injectedStrategy instanceof CdkDynamicSizeVirtualScrollStrategy).toBe(true);
  });

  it('forwards sizes, buffers, stretch, and disableAppending through ngOnChanges', fakeAsync(() => {
    const updateSpy = spyOn(dynamicSize._scrollStrategy, 'updateItemAndBufferSize').and.callThrough();
    testHost.sizes = [40, 40, 40, 40];
    testHost.minBufferPx = 20;
    testHost.maxBufferPx = 40;
    testHost.stretch = true;
    testHost.disableAppending = true;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();

    expect(updateSpy).toHaveBeenCalledWith([40, 40, 40, 40], 20, 40, true, true);
  }));

  it('forwards visibleRange to setVisibleRowRange without going through the CdkVisibleRange host', fakeAsync(() => {
    const rangeSpy = spyOn(dynamicSize._scrollStrategy, 'setVisibleRowRange').and.callThrough();
    dynamicSize.visibleRange = {start: 1, end: 4};
    expect(rangeSpy).toHaveBeenCalledWith({start: 1, end: 4});
    expect(dynamicSize._scrollStrategy.gridVisibleRowRange).toEqual({start: 1, end: 4});
  }));

  it('forwards rowindex to gridRowIndex', () => {
    dynamicSize.rowindex = 3;
    expect(dynamicSize._scrollStrategy.gridRowIndex).toBe(3);
  });

  it('accepts stretch as a plain boolean input and defaults to false', () => {
    expect(dynamicSize._stretch).toBe(false);
    testHost.stretch = true;
    fixture.detectChanges();
    expect(dynamicSize._stretch).toBe(true);
  });

  it('keeps name unused except as an ngOnChanges trigger', fakeAsync(() => {
    const updateSpy = spyOn(dynamicSize._scrollStrategy, 'updateItemAndBufferSize').and.callThrough();
    testHost.strategyName = 'columns';
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    flush();

    expect(dynamicSize.name).toBe('columns');
    expect(updateSpy).toHaveBeenCalled();
  }));

  it('leaves strategy detach to the viewport because the directive has no ngOnDestroy', fakeAsync(() => {
    const detachSpy = spyOn(dynamicSize._scrollStrategy, 'detach').and.callThrough();
    fixture.destroy();
    expect(detachSpy).toHaveBeenCalledTimes(1);
  }));
});

describe('CdkDynamicSizeVirtualScroll plain disableAppending binding', () => {
  it('does not coerce a bare disableAppending attribute the way booleanAttribute would', fakeAsync(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ScrollingModule, BareDisableAppendingHost],
    });
    const bareFixture = TestBed.createComponent(BareDisableAppendingHost);
    bareFixture.detectChanges();
    flush();

    expect(bareFixture.componentInstance.dynamicSize.disableAppending as unknown)
      .withContext('plain @Input; bare attribute is the empty string, not boolean false')
      .toBe('' as unknown);
  }));

  it('treats disableAppending="false" as a non-empty string, not boolean false', fakeAsync(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ScrollingModule, StringFalseDisableAppendingHost],
    });
    const stringFixture = TestBed.createComponent(StringFalseDisableAppendingHost);
    stringFixture.detectChanges();
    flush();

    expect(stringFixture.componentInstance.dynamicSize.disableAppending as unknown)
      .withContext('plain @Input stores the string "false", which is truthy')
      .toBe('false' as unknown);
  }));
});

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        dynamicSize
        [sizes]="sizes"
        [minBufferPx]="minBufferPx"
        [maxBufferPx]="maxBufferPx"
        [disableAppending]="disableAppending"
        [stretch]="stretch"
        [name]="strategyName"
        [style.height.px]="200"
        [style.width.px]="200">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
})
class DynamicDirectiveHost {
  @ViewChild(CdkDynamicSizeVirtualScroll, {static: true}) dynamicSize: CdkDynamicSizeVirtualScroll;
  items = [0, 1, 2, 3];
  sizes = [50, 50, 50, 50];
  minBufferPx = 100;
  maxBufferPx = 200;
  disableAppending = false;
  stretch = false;
  strategyName: string | undefined;
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport dynamicSize disableAppending [sizes]="sizes"
        [style.height.px]="200" [style.width.px]="200">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class BareDisableAppendingHost {
  @ViewChild(CdkDynamicSizeVirtualScroll, {static: true}) dynamicSize: CdkDynamicSizeVirtualScroll;
  items = [0, 1];
  sizes = [50, 50];
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport dynamicSize disableAppending="false" [sizes]="sizes"
        [style.height.px]="200" [style.width.px]="200">
      <div *cdkVirtualFor="let item of items">{{item}}</div>
    </cdk-virtual-scroll-viewport>
  `,
  imports: [ScrollingModule],
})
class StringFalseDisableAppendingHost {
  @ViewChild(CdkDynamicSizeVirtualScroll, {static: true}) dynamicSize: CdkDynamicSizeVirtualScroll;
  items = [0, 1];
  sizes = [50, 50];
}
