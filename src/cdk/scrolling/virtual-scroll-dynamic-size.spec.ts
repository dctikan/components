import {CdkDynamicSizeVirtualScroll, CdkVirtualScrollViewport, ScrollingModule} from '../scrolling';
import {Component, ViewChild, ViewEncapsulation} from '@angular/core';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
  tick,
  waitForAsync,
} from '@angular/core/testing';
import {dispatchFakeEvent} from '../testing/private';

describe('CdkVirtualScrollViewport with CdkDynamicSizeVirtualScrollStrategy', () => {
  let fixture: ComponentFixture<DynamicSizeVirtualScroll>;
  let testComponent: DynamicSizeVirtualScroll;
  let viewport: CdkVirtualScrollViewport;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ScrollingModule, DynamicSizeVirtualScroll],
    });
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DynamicSizeVirtualScroll);
    testComponent = fixture.componentInstance;
    viewport = testComponent.viewport;
  });

  const VIRTUAL_SCROLL_ORIENTATIONS = ['vertical', 'horizontal'];

  VIRTUAL_SCROLL_ORIENTATIONS.forEach(orientation => {
    describe(`${orientation} orientation`, () => {
      describe('same sizes', () => {
        const baseConfig = {
          viewport: '600',
          orientation: orientation,
          itemSource: ['200', '200', '200', '200', '200', '200'],
          minBuffer: '100',
          maxBuffer: '200',
          scrollOffset: '0',
          disableAppending: true,
        } as DynamicSizeSpecProperties;

        describe('no scroll offset - just was rendered', () => {
          const config = {
            ...baseConfig,
          } as DynamicSizeSpecProperties;

          it('maxBuffer: 200', fakeAsync(() => {
            expectRenderedState(setupAndGetRenderedRange(config, fixture, testComponent, viewport), {
              start: 0,
              end: 4,
              itemsIds: ['0', '1', '2', '3'],
            });
          }));

          it('maxBuffer: 400', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  maxBuffer: '400',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 0,
                end: 5,
                itemsIds: ['0', '1', '2', '3', '4'],
              },
            );
          }));
        });

        describe('offset: 100px - a bit scrolled from the start', () => {
          const config = {
            ...baseConfig,
            scrollOffset: '100',
          } as DynamicSizeSpecProperties;

          it('maxBuffer: 200', fakeAsync(() => {
            expectRenderedState(setupAndGetRenderedRange(config, fixture, testComponent, viewport), {
              start: 0,
              end: 4,
              itemsIds: ['0', '1', '2', '3'],
            });
          }));

          it('maxBuffer: 200 & minBuffer: 101', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  minBuffer: '101',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 0,
                end: 5,
                itemsIds: ['0', '1', '2', '3', '4'],
              },
            );
          }));

          it('maxBuffer: 200 & minBuffer: 101 & 8 items', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  itemSource: ['200', '200', '200', '200', '200', '200', '200', '200'],
                  minBuffer: '101',
                  maxBuffer: '400',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 0,
                end: 5,
                itemsIds: ['0', '1', '2', '3', '4'],
              },
            );
          }));

          it('maxBuffer: 400', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  maxBuffer: '400',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 0,
                end: 5,
                itemsIds: ['0', '1', '2', '3', '4'],
              },
            );
          }));

          it('maxBuffer: 400 & minBuffer: 101', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  minBuffer: '101',
                  maxBuffer: '400',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 0,
                end: 5,
                itemsIds: ['0', '1', '2', '3', '4'],
              },
            );
          }));

          it('maxBuffer: 400 & minBuffer: 101 & 8 items', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  itemSource: ['200', '200', '200', '200', '200', '200', '200', '200'],
                  minBuffer: '101',
                  maxBuffer: '400',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 0,
                end: 5,
                itemsIds: ['0', '1', '2', '3', '4'],
              },
            );
          }));
        });

        describe('offset: 600px - in the middle of list', () => {
          const config = {
            ...baseConfig,
            itemSource: ['200', '200', '200', '200', '200', '200', '200', '200', '200'],
            scrollOffset: '600',
          } as DynamicSizeSpecProperties;

          it('minBuffer: 100 & maxBuffer: 200', fakeAsync(() => {
            expectRenderedState(setupAndGetRenderedRange(config, fixture, testComponent, viewport), {
              start: 1,
              end: 7,
              // since we have offset: 600px and first three in total have also 600px, the "start" becomes firstVisibleIndex - 1 = 1
              itemsIds: ['1', '2', '3', '4', '5', '6'],
            });
          }));

          it('offset: 601px, minBuffer: 100, maxBuffer: 200', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {
                  ...config,
                  scrollOffset: '601',
                },
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 2,
                end: 8,
                itemsIds: ['2', '3', '4', '5', '6', '7'],
              },
            );
          }));
        });

        describe('offset: 1200px - at the end of list', () => {
          const config = {
            ...baseConfig,
            itemSource: ['200', '200', '200', '200', '200', '200', '200', '200', '200'],
            scrollOffset: '1200',
          } as DynamicSizeSpecProperties;

          it('maxBuffer: 200', fakeAsync(() => {
            expectRenderedState(setupAndGetRenderedRange(config, fixture, testComponent, viewport), {
              start: 4,
              end: 9,
              itemsIds: ['4', '5', '6', '7', '8'],
            });
          }));

          it('maxBuffer: 400', fakeAsync(() => {
            expectRenderedState(
              setupAndGetRenderedRange(
                {...config, maxBuffer: '400'},
                fixture,
                testComponent,
                viewport,
              ),
              {
                start: 3,
                end: 9,
                itemsIds: ['3', '4', '5', '6', '7', '8'],
              },
            );
          }));
        });
      });

      describe('sizes changes', () => {
        const baseConfig = {
          viewport: '600',
          orientation: orientation,
          itemSource: [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '200'},
            {id: '3', size: '200'},
            {id: '4', size: '200'},
          ],
          minBuffer: '100',
          maxBuffer: '200',
          scrollOffset: '0',
          disableAppending: true,
        } as DynamicSizeSpecProperties;

        it('item got bigger than viewport', fakeAsync(() => {
          setupAndGetRenderedRange(baseConfig, fixture, testComponent, viewport);

          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 0,
            end: 4,
            itemsIds: ['0', '1', '2', '3'],
          });

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '400'},
            {id: '2', size: '200'},
            {id: '3', size: '200'},
            {id: '4', size: '200'},
          ]);

          triggerViewport(fixture, viewport);
          // at this point we do not remove item '3', that is how algorithm is implemented
          // todo: research - should we remove that items? #2890
          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 0,
            end: 4,
            itemsIds: ['0', '1', '2', '3'],
          });
        }));

        it('item size was bigger than viewport and become 1/3 of viewport', fakeAsync(() => {
          const config = {
            ...baseConfig,
            itemSource: [
              {id: '0', size: '200'},
              {id: '1', size: '400'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
            ],
          } as DynamicSizeSpecProperties;
          setupAndGetRenderedRange(config, fixture, testComponent, viewport);

          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 0,
            end: 3,
            itemsIds: ['0', '1', '2'],
          });

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '200'},
            {id: '3', size: '200'},
            {id: '4', size: '200'},
          ]);

          triggerViewport(fixture, viewport);

          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 0,
            end: 4,
            itemsIds: ['0', '1', '2', '3'],
          });
        }));

        it('item still inside the final DOM range grew from 200 to 400', fakeAsync(() => {
          setupAndGetRenderedRange(baseConfig, fixture, testComponent, viewport);

          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 0,
            end: 4,
            itemsIds: ['0', '1', '2', '3'],
          });

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '200'},
            {id: '3', size: '400'}, // this is changed from 200 to 400
            {id: '4', size: '200'},
          ]);

          triggerViewport(fixture, viewport);
          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 0,
            end: 4,
            itemsIds: ['0', '1', '2', '3'],
          });
        }));

        it('item inside the scrolled final DOM range grew from 200 to 600', fakeAsync(() => {
          const config = {
            ...baseConfig,
            scrollOffset: '600',
            itemSource: [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'},
            ],
          } as DynamicSizeSpecProperties;
          const range = setupAndGetRenderedRange(config, fixture, testComponent, viewport);

          const expectedRange = {
            start: 1,
            end: 6,
            itemsIds: ['1', '2', '3', '4', '5'],
          };

          expectRenderedState(range, expectedRange);

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '600'},
            {id: '3', size: '200'},
            {id: '4', size: '200'},
            {id: '5', size: '200'},
          ]);

          triggerViewport(fixture, viewport);

          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), expectedRange);
        }));

        it('item inside the scrolled final DOM range shrank from 600 to 200', fakeAsync(() => {
          const config = {
            ...baseConfig,
            scrollOffset: '600',
            itemSource: [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '600'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'},
            ],
          } as DynamicSizeSpecProperties;
          const range = setupAndGetRenderedRange(config, fixture, testComponent, viewport);

          const expectedRange = {
            start: 1,
            end: 5,
            itemsIds: ['1', '2', '3', '4'],
          };

          expectRenderedState(range, expectedRange);

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '200'},
            {id: '3', size: '200'},
            {id: '4', size: '200'},
            {id: '5', size: '200'},
          ]);

          triggerViewport(fixture, viewport);

          expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
            start: 1,
            end: 6,
            itemsIds: ['1', '2', '3', '4', '5'],
          });
        }));
      });

      it('items less than viewport', fakeAsync(() => {
        const config = {
          viewport: '600',
          orientation: orientation,
          itemSource: ['200', '200', '200'],
          minBuffer: '100',
          maxBuffer: '200',
          scrollOffset: '0',
          disableAppending: true,
        } as DynamicSizeSpecProperties;

        expectRenderedState(setupAndGetRenderedRange(config, fixture, testComponent, viewport), {
          start: 0,
          end: 3,
          itemsIds: ['0', '1', '2'],
        });
      }));

      describe('disable appending: false', () => {
        it('renderedRange should contain previously rendered items', fakeAsync(() => {
          const config = {
            viewport: '600',
            orientation: orientation,
            itemSource: ['200', '200', '200', '200', '200', '200', '200', '200', '200'],
            minBuffer: '100',
            maxBuffer: '200',
            scrollOffset: '1200',
            disableAppending: false,
          } as DynamicSizeSpecProperties;
          const rendered = setupAndGetRenderedRange(config, fixture, testComponent, viewport);
          expect(rendered.start).toEqual(0);
          expect(rendered.end).toEqual(9);

          triggerScroll(viewport, 0);

          const renderedAfterScrollMove = collectRenderedState(fixture, viewport, testComponent);
          expect(renderedAfterScrollMove.start).toEqual(0);
          expect(renderedAfterScrollMove.end).toEqual(9);
        }));

        it('renderedRange should contain items when they are removed and added', fakeAsync(() => {
          const config = {
            viewport: '600',
            orientation: orientation,
            itemSource: [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'},
              {id: '6', size: '200'},
              {id: '7', size: '200'},
              {id: '8', size: '200'},
            ],
            minBuffer: '100',
            maxBuffer: '200',
            scrollOffset: '1200',
            disableAppending: false,
          } as DynamicSizeSpecProperties;
          const rendered = setupAndGetRenderedRange(config, fixture, testComponent, viewport);
          expect(rendered.start).toEqual(0);
          expect(rendered.end).toEqual(9);

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '200'},
            {id: '3', size: '200'},
            {id: '5', size: '200'},
            {id: '6', size: '200'},
            {id: '7', size: '200'},
            {id: '8', size: '200'},
          ]); // removed 1

          triggerViewport(fixture, viewport);

          const rendered1 = collectRenderedState(fixture, viewport, testComponent);
          expect(rendered1.start).toEqual(0);
          expect(rendered1.end).toEqual(8);

          assignItemsAndSizes(fixture.componentInstance, [
            {id: '0', size: '200'},
            {id: '1', size: '200'},
            {id: '2', size: '200'},
            {id: '3', size: '200'},
            {id: '5', size: '200'},
            {id: '6', size: '200'},
            {id: '7', size: '200'},
            {id: '8', size: '200'},
            {id: '9', size: '200'},
          ]); // added 1

          triggerViewport(fixture, viewport);

          const rendered2 = collectRenderedState(fixture, viewport, testComponent);
          expect(rendered2.start).toEqual(3);
          expect(rendered2.end).toEqual(9);
        }));
      });

      describe('some items in list are removed', () => {
        const baseConfig = {
          viewport: '600',
          orientation: orientation,
          itemSource: ['200', '200', '200', '200', '200', '200'],
          minBuffer: '100',
          maxBuffer: '200',
          scrollOffset: '0',
          disableAppending: true,
        } as DynamicSizeSpecProperties;

        describe('offset: start of the list, remove items so they are less than viewport', () => {
          it('less than viewport', fakeAsync(() => {
            setupAndGetRenderedRange(baseConfig, fixture, testComponent, viewport);
            assignItemsAndSizes(fixture.componentInstance, ['200', '200']);

            fixture.changeDetectorRef.markForCheck();
            fixture.detectChanges();
            flush();

            expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
              start: 0,
              end: 2,
              itemsIds: ['0', '1'],
            });
          }));

          it('removed buffered item after viewport', fakeAsync(() => {
            setupAndGetRenderedRange(
              {
                ...baseConfig,
                itemSource: [
                  {id: '0', size: '200'},
                  {id: '1', size: '200'},
                  {id: '2', size: '200'},
                  {id: '3', size: '200'},
                  {id: '4', size: '200'},
                  {id: '5', size: '200'},
                ],
              },
              fixture,
              testComponent,
              viewport,
            );

            assignItemsAndSizes(fixture.componentInstance, [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'},
            ]);

            triggerViewport(fixture, viewport);

            expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
              start: 0,
              end: 4,
              itemsIds: ['0', '1', '2', '4'],
            });
          }));
        });

        describe('offset: in the middle of the list, middles items are removed', () => {
          const config = {
            ...baseConfig,
            scrollOffset: '600',
            itemSource: [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'},
              {id: '6', size: '200'},
              {id: '7', size: '200'},
              {id: '8', size: '200'},
            ],
          };

          it('less than viewport, before 9 items, after removal 7 items', fakeAsync(() => {
            setupAndGetRenderedRange(config, fixture, testComponent, viewport);
            assignItemsAndSizes(fixture.componentInstance, [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '6', size: '200'},
              {id: '7', size: '200'},
              {id: '8', size: '200'},
            ]);

            triggerViewport(fixture, viewport);

            expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
              start: 1,
              end: 7,
              itemsIds: ['1', '2', '3', '6', '7', '8'],
            });
          }));

          it('removed one item on each side of the scrolled window', fakeAsync(() => {
            setupAndGetRenderedRange(config, fixture, testComponent, viewport);
            assignItemsAndSizes(fixture.componentInstance, [
              {id: '0', size: '200'},
              {id: '1', size: '200'}, // 2 was removed
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'}, // 6 was removed
              {id: '7', size: '200'},
              {id: '8', size: '200'},
            ]);

            triggerViewport(fixture, viewport);

            expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
              start: 1,
              end: 7,
              itemsIds: ['1', '3', '4', '5', '7', '8'],
            });
          }));
        });

        describe('offset: end of the list, last items are removed', () => {
          it('less than viewport, before 6 items, after removal 5 items', fakeAsync(() => {
            setupAndGetRenderedRange(
              {...baseConfig, scrollOffset: '600'},
              fixture,
              testComponent,
              viewport,
            );
            assignItemsAndSizes(fixture.componentInstance, ['200', '200', '200', '200', '200']);

            triggerViewport(fixture, viewport);

            expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
              start: 1,
              end: 5,
              itemsIds: ['1', '2', '3', '4'],
            });
          }));

          it('removed one item from the scrolled end window', fakeAsync(() => {
            const itemSource = [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '5', size: '200'},
              {id: '6', size: '200'},
              {id: '7', size: '200'},
              {id: '8', size: '200'},
            ];

            setupAndGetRenderedRange(
              {...baseConfig, itemSource: itemSource, scrollOffset: '1200'},
              fixture,
              testComponent,
              viewport,
            );
            assignItemsAndSizes(fixture.componentInstance, [
              {id: '0', size: '200'},
              {id: '1', size: '200'},
              {id: '2', size: '200'},
              {id: '3', size: '200'},
              {id: '4', size: '200'},
              {id: '6', size: '200'}, // 5 was removed
              {id: '7', size: '200'},
              {id: '8', size: '200'},
            ]);

            triggerViewport(fixture, viewport);

            expectRenderedState(collectRenderedState(fixture, viewport, testComponent), {
              start: 4,
              end: 8,
              itemsIds: ['4', '6', '7', '8'],
            });
          }));
        });
      });

      describe('different sizes', () => {
        const config = {
          viewport: '600',
          orientation: orientation,
          itemSource: ['200', '400', '200', '400', '100', '100'],
          minBuffer: '100',
          maxBuffer: '200',
          scrollOffset: '0',
          disableAppending: true,
        } as DynamicSizeSpecProperties;

        it('maxBuffer: 200', fakeAsync(() => {
          expectRenderedState(setupAndGetRenderedRange(config, fixture, testComponent, viewport), {
            start: 0,
            end: 3,
            itemsIds: ['0', '1', '2'],
          });
        }));

        it('maxBuffer: 400', fakeAsync(() => {
          expectRenderedState(
            setupAndGetRenderedRange(
              {
                ...config,
                maxBuffer: '400',
              },
              fixture,
              testComponent,
              viewport,
            ),
            {
              start: 0,
              end: 4,
              itemsIds: ['0', '1', '2', '3'],
            },
          );
        }));
      });

      describe('fork characterization', () => {
        const nineEqualItems = {
          viewport: '600',
          orientation,
          itemSource: ['200', '200', '200', '200', '200', '200', '200', '200', '200'],
          minBuffer: '100',
          maxBuffer: '200',
          scrollOffset: '0',
          disableAppending: true,
        } as DynamicSizeSpecProperties;

        it('emits firstVisibleIndex 2 at the exact 600px item boundary', fakeAsync(() => {
          const renderedState = setupAndGetRenderedRange(
            {...nineEqualItems, scrollOffset: '600'},
            fixture,
            testComponent,
            viewport,
          );
          expectRenderedState(renderedState, {
            start: 1,
            end: 7,
            itemsIds: ['1', '2', '3', '4', '5', '6'],
            scrollOffset: 600,
            firstVisibleIndex: 2,
            contentOffset: 200,
          });
        }));

        it('keeps scrollToIndex(0) at offset 0', fakeAsync(() => {
          setupAndGetRenderedRange(nineEqualItems, fixture, testComponent, viewport);
          viewport.scrollToIndex(0);
          triggerScroll(viewport);
          fixture.detectChanges();
          flush();
          expect(viewport.measureScrollOffset()).toBe(0);
          expect(testComponent.scrolledToIndex).toBe(0);
        }));

        it('treats a non-zero scrollToIndex argument as an offset into sizes, not as an item index', fakeAsync(() => {
          setupAndGetRenderedRange(nineEqualItems, fixture, testComponent, viewport);
          viewport.scrollToIndex(3);
          triggerScroll(viewport);
          fixture.detectChanges();
          flush();
          // Current source: scrollToOffset(_getItemIdxByOffset(3)) => scrollToOffset(0).
          expect(viewport.measureScrollOffset()).toBe(0);
          expect(testComponent.scrolledToIndex).toBe(0);
        }));

        it('scrollToIndex(250) currently scrolls 1px because the looked-up index is used as pixels', fakeAsync(() => {
          setupAndGetRenderedRange(nineEqualItems, fixture, testComponent, viewport);
          viewport.scrollToIndex(250);
          triggerScroll(viewport);
          fixture.detectChanges();
          flush();
          expect(viewport.measureScrollOffset()).toBe(1);
        }));

        it('rebuilds an unequal-size window from the current offset, not from index 0', fakeAsync(() => {
          const renderedState = setupAndGetRenderedRange(
            {
              viewport: '600',
              orientation,
              itemSource: ['200', '400', '200', '400', '100', '100'],
              minBuffer: '100',
              maxBuffer: '200',
              scrollOffset: '600',
              disableAppending: true,
            },
            fixture,
            testComponent,
            viewport,
          );
          expect(renderedState.firstVisibleIndex).toBe(1);
          expect(renderedState.start).toBeGreaterThan(0);
          expect(renderedState.contentOffset).toBe(renderedState.start === 1 ? 200 : renderedState.contentOffset);
        }));

        it('sets wrapper height to 100% only when stretch is true and content is shorter than the viewport', fakeAsync(() => {
          const stretchedState = setupAndGetRenderedRange(
            {
              viewport: '600',
              orientation,
              itemSource: ['200', '200'],
              minBuffer: '100',
              maxBuffer: '200',
              scrollOffset: '0',
              disableAppending: true,
              stretch: true,
            },
            fixture,
            testComponent,
            viewport,
          );
          expect(stretchedState.wrapperHeight).toBe('100%');

          const unstretchedState = setupAndGetRenderedRange(
            {
              viewport: '600',
              orientation,
              itemSource: ['200', '200'],
              minBuffer: '100',
              maxBuffer: '200',
              scrollOffset: '0',
              disableAppending: true,
              stretch: false,
            },
            fixture,
            testComponent,
            viewport,
          );
          expect(unstretchedState.wrapperHeight).toBe('');
        }));

        it('updates a nested row whose rowindex is inside the inclusive coordination end', fakeAsync(() => {
          const renderedState = setupAndGetRenderedRange(
            {
              ...nineEqualItems,
              scrollOffset: '600',
              visibleRange: {start: 0, end: 4},
              rowIndex: 4,
            },
            fixture,
            testComponent,
            viewport,
          );
          expect(renderedState.start).toBe(1);
          expect(renderedState.end).toBe(7);
        }));

        it('does not update a nested row whose rowindex is greater than the inclusive coordination end', fakeAsync(() => {
          setupAndGetRenderedRange(
            {
              ...nineEqualItems,
              scrollOffset: '0',
              visibleRange: {start: 0, end: 4},
              rowIndex: 5,
            },
            fixture,
            testComponent,
            viewport,
          );
          const rangeAfterInit = viewport.getRenderedRange();
          triggerScroll(viewport, 600);
          fixture.detectChanges();
          flush();
          expect(viewport.getRenderedRange()).toEqual(rangeAfterInit);
        }));

        it('onDataLengthChanged bypasses nested gating and rebuilds the range', fakeAsync(() => {
          setupAndGetRenderedRange(
            {
              ...nineEqualItems,
              scrollOffset: '0',
              visibleRange: {start: 0, end: 4},
              rowIndex: 5,
            },
            fixture,
            testComponent,
            viewport,
          );
          testComponent.items = toItems(['200', '200']);
          testComponent.sizes = [200, 200];
          triggerViewport(fixture, viewport);
          expect(viewport.getRenderedRange()).toEqual({start: 0, end: 2});
        }));

        it('resets the historical envelope when sizes change while accumulation is on', fakeAsync(() => {
          setupAndGetRenderedRange(
            {...nineEqualItems, scrollOffset: '1200', disableAppending: false},
            fixture,
            testComponent,
            viewport,
          );
          expect(viewport.getRenderedRange()).toEqual({start: 0, end: 9});

          testComponent.sizes = [200, 200, 200, 200, 200, 200, 200, 200, 200];
          triggerViewport(fixture, viewport);
          const rangeAfterReset = viewport.getRenderedRange();
          expect(rangeAfterReset.start).toBeGreaterThan(0);
          expect(rangeAfterReset.end).toBe(9);
        }));

        it('uses the shorter sizes array when items and sizes lengths diverge', fakeAsync(() => {
          const renderedState = setupAndGetRenderedRange(
            {
              viewport: '600',
              orientation,
              items: toItems(['200', '200', '200', '200', '200', '200']),
              sizes: [200, 200, 200],
              minBuffer: '100',
              maxBuffer: '200',
              scrollOffset: '0',
              disableAppending: true,
            },
            fixture,
            testComponent,
            viewport,
          );
          expect(renderedState.itemsIds.length).toBeGreaterThan(0);
          expect(Number.isFinite(renderedState.scrollOffset)).toBe(true);
        }));

        it('does not throw when sizes contain NaN or a negative number', fakeAsync(() => {
          expect(() => {
            setupAndGetRenderedRange(
              {
                viewport: '600',
                orientation,
                items: toItems(['200', '200', '200', '200']),
                sizes: [200, Number.NaN, -50, 200],
                minBuffer: '100',
                maxBuffer: '200',
                scrollOffset: '0',
                disableAppending: true,
              },
              fixture,
              testComponent,
              viewport,
            );
          }).not.toThrow();
        }));
      });
    });
    // #2890
    // describe('two directional virtual scroll', () => {});
    // describe('table of virtual scrolls (one direction)', () => {});
    // describe('renderedRange specs')', () => {});
  });
});

/** Finish initializing the virtual scroll component at the beginning of a test. */
function finishInit(fixture: ComponentFixture<DynamicSizeVirtualScroll>) {
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

function triggerViewport(
  fixture: ComponentFixture<DynamicSizeVirtualScroll>,
  viewport: CdkVirtualScrollViewport,
) {
  fixture.changeDetectorRef.markForCheck();
  fixture.detectChanges();
  flush();
  triggerScroll(viewport);
  fixture.detectChanges();
  flush();
}

/** Trigger a scroll event on the viewport (optionally setting a new scroll offset). */
function triggerScroll(viewport: CdkVirtualScrollViewport, offset?: number) {
  if (offset !== undefined) {
    viewport.scrollToOffset(offset);
  }
  dispatchFakeEvent(viewport.scrollable!.getElementRef().nativeElement, 'scroll');
  tick(16); // flush animation frame
}

type DynamicSizeObjectSize = {id: string; size: string};
type DynamicSizeSizes = string[] | DynamicSizeObjectSize[];

interface DynamicSizeSpecProperties {
  viewport: string;
  orientation: 'horizontal' | 'vertical';
  itemSource?: DynamicSizeSizes;
  items?: DynamicSizeObjectSize[];
  sizes?: number[];
  minBuffer: string;
  maxBuffer: string;
  scrollOffset: string;
  disableAppending: boolean;
  stretch?: boolean;
  visibleRange?: {start: number; end: number} | null;
  rowIndex?: number;
}

interface DynamicSizeRenderedState {
  start: number;
  end: number;
  itemsIds: string[];
  scrollOffset: number;
  firstVisibleIndex: number | null;
  totalContentSize: number;
  contentOffset: number | null;
  wrapperHeight: string;
}

function toItems(itemSource: DynamicSizeSizes): DynamicSizeObjectSize[] {
  return itemSource.map((entry, entryIndex) =>
    typeof entry === 'string' ? {id: String(entryIndex), size: entry} : entry,
  );
}

function assignItemsAndSizes(host: DynamicSizeVirtualScroll, itemSource: DynamicSizeSizes): void {
  const nextItems = toItems(itemSource);
  host.items = nextItems;
  host.sizes = nextItems.map(item => Number(item.size));
}

function collectRenderedState(
  fixture: ComponentFixture<DynamicSizeVirtualScroll>,
  viewport: CdkVirtualScrollViewport,
  testComponent: DynamicSizeVirtualScroll,
): DynamicSizeRenderedState {
  const renderedRange = viewport.getRenderedRange();
  const renderedItems: Element[] = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll('.item[data-id]'),
  );
  return {
    start: renderedRange.start,
    end: renderedRange.end,
    itemsIds: renderedItems.map(item => item.getAttribute('data-id') ?? ''),
    scrollOffset: viewport.measureScrollOffset(),
    firstVisibleIndex: testComponent.scrolledToIndex,
    totalContentSize: viewport.measureRenderedContentSize(),
    contentOffset: viewport.getOffsetToRenderedContentStart(),
    wrapperHeight: viewport._contentWrapper.nativeElement.style.height,
  };
}

function expectRenderedState(
  actualState: DynamicSizeRenderedState,
  expectedState: Partial<DynamicSizeRenderedState> & {start: number; end: number; itemsIds: string[]},
) {
  expect(actualState)
    .withContext(
      `start=${actualState.start} end=${actualState.end} ids=${actualState.itemsIds.join(',')} ` +
        `offset=${actualState.scrollOffset} firstVisible=${actualState.firstVisibleIndex} ` +
        `contentOffset=${actualState.contentOffset} wrapperHeight=${actualState.wrapperHeight}`,
    )
    .toEqual(jasmine.objectContaining(expectedState));
}

function setupAndGetRenderedRange(
  properties: DynamicSizeSpecProperties,
  fixture: ComponentFixture<DynamicSizeVirtualScroll>,
  testComponent: DynamicSizeVirtualScroll,
  viewport: CdkVirtualScrollViewport,
): DynamicSizeRenderedState {
  testComponent.viewportSize = Number(properties.viewport);
  testComponent.orientation = properties.orientation;
  const nextItems = properties.items ?? toItems(properties.itemSource ?? []);
  testComponent.items = nextItems.slice();
  testComponent.sizes = properties.sizes
    ? properties.sizes.slice()
    : nextItems.map(item => Number(item.size));
  testComponent.minBufferPx = Number(properties.minBuffer);
  testComponent.maxBufferPx = Number(properties.maxBuffer);
  testComponent.disableAppending = properties.disableAppending;
  testComponent.stretch = properties.stretch ?? false;
  testComponent.visibleRange = properties.visibleRange ?? null;
  testComponent.rowIndex = properties.rowIndex;
  testComponent.scrolledToIndex = null;

  const dynamicSize = testComponent.dynamicSize;
  if (properties.visibleRange) {
    dynamicSize.visibleRange = properties.visibleRange;
  }
  if (properties.rowIndex !== undefined) {
    dynamicSize.rowindex = properties.rowIndex;
  }

  finishInit(fixture);
  triggerScroll(viewport, Number(properties.scrollOffset));
  fixture.detectChanges();
  flush();

  return collectRenderedState(fixture, viewport, testComponent);
}

@Component({
  template: `
    <cdk-virtual-scroll-viewport
        dynamicSize
        [sizes]="sizes"
        [minBufferPx]="minBufferPx"
        [maxBufferPx]="maxBufferPx"
        [disableAppending]="disableAppending"
        [stretch]="stretch"
        [orientation]="orientation"
        [style.height.px]="viewportHeight"
        [style.width.px]="viewportWidth"
        (scrolledIndexChange)="scrolledToIndex = $event">
      <div
          class="item"
          *cdkVirtualFor="let item of items; let itemIndex = index; trackBy: trackByItem"
          [attr.data-id]="item.id"
          [style.height.px]="orientation == 'vertical' ? getItemSize(item) : 50"
          [style.width.px]="orientation == 'horizontal' ? getItemSize(item) : 50">
        {{getItemSize(item)}} {{itemIndex}}
      </div>
    </cdk-virtual-scroll-viewport>
  `,
  styles: `
    .cdk-virtual-scroll-content-wrapper {
      display: flex;
      flex-direction: column;
    }

    cdk-virtual-scroll-viewport {
      border: 1px solid black;
    }

    .item {
      outline: 1px solid gray;
    }

    .cdk-virtual-scroll-orientation-horizontal .cdk-virtual-scroll-content-wrapper {
      flex-direction: row;
    }
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollingModule],
})
class DynamicSizeVirtualScroll {
  @ViewChild(CdkVirtualScrollViewport, {static: true}) viewport: CdkVirtualScrollViewport;
  @ViewChild(CdkDynamicSizeVirtualScroll, {static: true}) dynamicSize: CdkDynamicSizeVirtualScroll;

  orientation: 'vertical' | 'horizontal' = 'vertical';
  viewportSize = 100;
  viewportCrossSize = 100;
  items: DynamicSizeObjectSize[] = [
    {id: '0', size: '20'},
    {id: '1', size: '40'},
    {id: '2', size: '60'},
    {id: '3', size: '80'},
    {id: '4', size: '100'},
    {id: '5', size: '120'},
  ];
  sizes: number[] = [20, 40, 60, 80, 100, 120];
  visibleRange: {start: number; end: number} | null = null;
  rowIndex: number | undefined = undefined;
  scrolledToIndex: number | null = null;
  minBufferPx = 0;
  maxBufferPx = 0;
  disableAppending = true;
  stretch = false;

  get viewportWidth() {
    return this.orientation == 'horizontal' ? this.viewportSize : this.viewportCrossSize;
  }

  get viewportHeight() {
    return this.orientation == 'horizontal' ? this.viewportCrossSize : this.viewportSize;
  }

  trackByItem(_itemIndex: number, item: DynamicSizeObjectSize): string {
    return item.id;
  }

  getItemSize(item: DynamicSizeObjectSize): number {
    return Number(item.size);
  }
}
