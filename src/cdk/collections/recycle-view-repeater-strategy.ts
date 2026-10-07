/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {
  EmbeddedViewRef,
  Injector,
  IterableChangeRecord,
  IterableChanges,
  ViewContainerRef,
  inject,
} from '@angular/core';
import {Subscription} from 'rxjs';
import {
  RecycleViewDetachEvent,
  RecycleViewElementsState,
} from './recycle-view-elements-state.service';
import {
  _ViewRepeater,
  _ViewRepeaterItemChanged,
  _ViewRepeaterItemContext,
  _ViewRepeaterItemContextFactory,
  _ViewRepeaterItemInsertArgs,
  _ViewRepeaterItemValueResolver,
  _ViewRepeaterOperation,
} from './view-repeater';

/**
 * A repeater that caches views when they are removed from a
 * `ViewContainerRef`. When new items are inserted into the container,
 * the repeater will reuse one of the cached views instead of creating a new
 * embedded view. Recycling cached views reduces the quantity of expensive DOM
 * inserts.
 *
 * @template T The type for the embedded view's $implicit property.
 * @template R The type for the item in each IterableDiffer change record.
 * @template C The type for the context passed to each embedded view.
 */
export class _RecycleViewRepeaterStrategy<
  T,
  R,
  C extends _ViewRepeaterItemContext<T>,
> implements _ViewRepeater<T, R, C> {
  /**
   * The size of the cache used to store unused views.
   * Setting the cache size to `0` will disable caching. Defaults to 20 views.
   */
  viewCacheSize: number = 20;

  /**
   * View cache that stores embedded view instances that have been previously stamped out,
   * but don't are not currently rendered. The view repeater will reuse these views rather than
   * creating brand new ones.
   *
   * TODO(michaeljamesparsons) Investigate whether using a linked list would improve performance.
   */
  private _viewCache: EmbeddedViewRef<C>[] = [];
  private _viewContainerRef: ViewContainerRef | null = null;
  private _state = inject(RecycleViewElementsState, {optional: true});
  private _subscription: Subscription | undefined;
  private _trackBy?: (index: number, item: T) => unknown;
  private _itemsTrackByIds: string[] = [];
  private _renderedRange = {start: 0, end: 0};
  private _storeScrollPosition = false;
  private _collectDetached: string | null = null;
  private _repeaterId: string | null = null;
  private _groupId: string | null = null;
  private _scrollRestoreGeneration = new WeakMap<EmbeddedViewRef<C>, number>();

  constructor() {
    this._subscription = this._state?.detachChanges.subscribe(change =>
      this._handleDetachChange(change),
    );
  }

  setTrackByFunction(trackBy: ((index: number, item: T) => unknown) | undefined): void {
    this._trackBy = trackBy;
  }
  setItemsTrackByIds(ids: string[]): void {
    this._itemsTrackByIds = ids;
  }
  setRenderedRange(range: {start: number; end: number}): void {
    this._renderedRange = range;
  }
  setStoreScrollPosition(value: boolean): void {
    this._storeScrollPosition = value;
  }
  setCollectDetached(value: string | null): void {
    this._collectDetached = value;
  }
  setRepeaterId(value: string | null): void {
    this._repeaterId = value;
  }
  setGroupId(value: string | null): void {
    this._groupId = value;
  }

  /** Apply changes to the DOM. */
  applyChanges(
    changes: IterableChanges<R>,
    viewContainerRef: ViewContainerRef,
    itemContextFactory: _ViewRepeaterItemContextFactory<T, R, C>,
    itemValueResolver: _ViewRepeaterItemValueResolver<T, R>,
    itemViewChanged?: _ViewRepeaterItemChanged<R, C>,
  ) {
    this._viewContainerRef = viewContainerRef;
    // Rearrange the views to put them in the right location.
    changes.forEachOperation(
      (
        record: IterableChangeRecord<R>,
        adjustedPreviousIndex: number | null,
        currentIndex: number | null,
      ) => {
        let view: EmbeddedViewRef<C> | undefined;
        let operation: _ViewRepeaterOperation;
        if (record.previousIndex == null) {
          // Item added.
          const viewArgsFactory = () =>
            itemContextFactory(record, adjustedPreviousIndex, currentIndex);
          view = this._insertView(
            viewArgsFactory,
            currentIndex!,
            viewContainerRef,
            itemValueResolver(record),
          );
          operation = view ? _ViewRepeaterOperation.INSERTED : _ViewRepeaterOperation.REPLACED;
        } else if (currentIndex == null) {
          // Item removed.
          if (this._collectDetached === null) {
            const id = this._getTrackById(itemValueResolver(record), record.previousIndex!);
            if (id !== null) this._state?.collectDetachedViews(id);
          }
          this._detachAndCacheView(adjustedPreviousIndex!, viewContainerRef);
          operation = _ViewRepeaterOperation.REMOVED;
        } else {
          // Item moved.
          view = this._moveView(
            adjustedPreviousIndex!,
            currentIndex!,
            viewContainerRef,
            itemValueResolver(record),
          );
          operation = _ViewRepeaterOperation.MOVED;
        }

        if (itemViewChanged) {
          itemViewChanged({
            context: view?.context,
            operation,
            record,
          });
        }
      },
    );
  }

  detach() {
    for (const view of this._viewCache) {
      view.destroy();
    }
    this._viewCache = [];
    this._subscription?.unsubscribe();
    this._viewContainerRef = null;
  }

  /**
   * Inserts a view for a new item, either from the cache or by creating a new
   * one. Returns `undefined` if the item was inserted into a cached view.
   */
  private _insertView(
    viewArgsFactory: () => _ViewRepeaterItemInsertArgs<C>,
    currentIndex: number,
    viewContainerRef: ViewContainerRef,
    value: T,
  ): EmbeddedViewRef<C> | undefined {
    const id = this._getTrackById(value, currentIndex);
    const retained = id === null ? null : this._state?.takeDetachedView<C>(id);
    if (retained) {
      viewContainerRef.insert(retained.view, currentIndex);
      retained.view.context.$implicit = value;
      this._restoreScrollPosition(retained.view, value, currentIndex);
      if (this._collectDetached === null) this._state?.notifyInsert(id!);
      return undefined;
    }
    const cachedView = this._insertViewFromCache(currentIndex!, viewContainerRef);
    if (cachedView) {
      cachedView.context.$implicit = value;
      this._restoreScrollPosition(cachedView, value, currentIndex, true);
      return undefined;
    }

    const viewArgs = viewArgsFactory();
    const view = viewContainerRef.createEmbeddedView(viewArgs.templateRef, viewArgs.context, {
      index: viewArgs.index,
      injector: this._state
        ? Injector.create({
            providers: [{provide: RecycleViewElementsState, useValue: this._state}],
            parent: viewContainerRef.injector,
          })
        : undefined,
    });
    this._restoreScrollPosition(view, value, currentIndex);
    return view;
  }

  /** Detaches the view at the given index and inserts into the view cache. */
  private _detachAndCacheView(index: number, viewContainerRef: ViewContainerRef) {
    const detachedView = viewContainerRef.get(index) as EmbeddedViewRef<C>;
    this._saveScrollPosition(detachedView, index);
    const id = this._getTrackById(detachedView.context.$implicit as T, index);
    if (id !== null && this._state?.isMarkedForDetach(id)) {
      this._state.retainDetachedView(id, detachedView, this._repeaterId, this._groupId);
      viewContainerRef.detach(index);
      return;
    }
    viewContainerRef.detach(index);
    this._maybeCacheView(detachedView, viewContainerRef);
  }

  /** Moves view at the previous index to the current index. */
  private _moveView(
    adjustedPreviousIndex: number,
    currentIndex: number,
    viewContainerRef: ViewContainerRef,
    value: T,
  ): EmbeddedViewRef<C> {
    const view = viewContainerRef.get(adjustedPreviousIndex!) as EmbeddedViewRef<C>;
    viewContainerRef.move(view, currentIndex);
    view.context.$implicit = value;
    this._restoreScrollPosition(view, value, currentIndex);
    return view;
  }

  /**
   * Cache the given detached view. If the cache is full, the view will be
   * destroyed.
   */
  private _maybeCacheView(view: EmbeddedViewRef<C>, viewContainerRef: ViewContainerRef) {
    if (this._viewCache.length < this.viewCacheSize) {
      this._viewCache.push(view);
    } else {
      const index = viewContainerRef.indexOf(view);

      // The host component could remove views from the container outside of
      // the view repeater. It's unlikely this will occur, but just in case,
      // destroy the view on its own, otherwise destroy it through the
      // container to ensure that all the references are removed.
      if (index === -1) {
        view.destroy();
      } else {
        viewContainerRef.remove(index);
      }
    }
  }

  /** Inserts a recycled view from the cache at the given index. */
  private _insertViewFromCache(
    index: number,
    viewContainerRef: ViewContainerRef,
  ): EmbeddedViewRef<C> | null {
    const cachedView = this._viewCache.pop();
    if (cachedView) {
      viewContainerRef.insert(cachedView, index);
    }
    return cachedView || null;
  }

  private _getTrackById(item: T, index: number): string | null {
    if (!this._trackBy) return null;
    const id = this._trackBy(this._renderedRange.start + index, item);
    return id === null ? null : String(id);
  }

  private _findRenderedIndex(id: string): number | null {
    if (!this._viewContainerRef || !this._trackBy) return null;
    for (let index = 0; index < this._viewContainerRef.length; index++) {
      const view = this._viewContainerRef.get(index) as EmbeddedViewRef<C>;
      if (this._getTrackById(view.context.$implicit as T, index) === id) return index;
    }
    return null;
  }

  private _handleDetachChange(change: RecycleViewDetachEvent): void {
    if (change.type === 'mark') {
      const index = this._findRenderedIndex(change.id);
      if (index !== null) {
        this._state?.retainDetachedView(
          change.id,
          this._viewContainerRef!.get(index) as EmbeddedViewRef<C>,
          this._repeaterId,
          this._groupId,
        );
      }
    } else if (
      change.type === 'collect' &&
      this._collectDetached !== null &&
      change.collectDetached === this._collectDetached
    ) {
      for (const id of this._state!.getDetachedIds()) {
        const index = this._findRenderedIndex(id);
        if (index !== null) this._viewContainerRef!.detach(index);
      }
    } else if (
      change.type === 'insert' &&
      change.collectDetached === this._collectDetached &&
      this._repeaterId &&
      this._viewContainerRef
    ) {
      const ids = this._state!.getDetachedIds().sort(
        (first, second) =>
          this._itemsTrackByIds.indexOf(first) - this._itemsTrackByIds.indexOf(second),
      );
      for (const id of ids) {
        const entry = this._state!.takeDetachedView<C>(id);
        if (!entry || entry.repeaterId !== this._repeaterId || this._findRenderedIndex(id) !== null)
          continue;
        const realIndex = this._itemsTrackByIds.indexOf(id);
        if (realIndex >= this._renderedRange.start && realIndex < this._renderedRange.end) {
          this._viewContainerRef.insert(entry.view, realIndex - this._renderedRange.start);
        }
      }
    }
  }

  private _scrollable(view: EmbeddedViewRef<C>): HTMLElement | null {
    for (const node of view.rootNodes) {
      if (!(node instanceof HTMLElement)) continue;
      const child = node.querySelector<HTMLElement>('.cdk-virtual-scrollable');
      if (child) {
        const style = getComputedStyle(child);
        if (
          ['auto', 'scroll'].includes(style.overflowX) ||
          ['auto', 'scroll'].includes(style.overflowY)
        )
          return child;
      }
      return node;
    }
    return null;
  }

  private _saveScrollPosition(view: EmbeddedViewRef<C>, index: number): void {
    if (!this._storeScrollPosition || !this._state) return;
    const id = this._getTrackById(view.context.$implicit as T, index);
    const element = this._scrollable(view);
    if (id && element && (element.scrollTop || element.scrollLeft)) {
      this._state.add(id, {
        scrollPosition: {scrollTop: element.scrollTop, scrollLeft: element.scrollLeft},
      });
    }
  }

  private _restoreScrollPosition(
    view: EmbeddedViewRef<C>,
    value: T,
    index: number,
    resetIfMissing = false,
  ): void {
    if (!this._storeScrollPosition || !this._state) return;
    const generation = (this._scrollRestoreGeneration.get(view) ?? 0) + 1;
    this._scrollRestoreGeneration.set(view, generation);
    const id = this._getTrackById(value, index);
    const state = id
      ? this._state.get<{scrollPosition?: {scrollTop: number; scrollLeft: number}}>(id)
      : undefined;
    if (state?.scrollPosition) {
      const {scrollTop, scrollLeft} = state.scrollPosition;
      requestAnimationFrame(() => {
        if (view.destroyed || this._scrollRestoreGeneration.get(view) !== generation) return;
        const element = this._scrollable(view);
        if (element) {
          element.scrollTop = scrollTop;
          element.scrollLeft = scrollLeft;
        }
      });
    } else if (resetIfMissing) {
      const element = this._scrollable(view);
      if (element) {
        element.scrollTop = 0;
        element.scrollLeft = 0;
      }
    }
  }
}
