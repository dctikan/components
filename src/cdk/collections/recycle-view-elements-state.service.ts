/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {EmbeddedViewRef, Injectable, OnDestroy} from '@angular/core';
import {BehaviorSubject, Observable, Subject} from 'rxjs';

export type RecycleViewDetachEvent =
  | {type: 'mark'; id: string}
  | {type: 'clear'}
  | {type: 'collect' | 'insert'; collectDetached: string};

interface DetachedEntry {
  view: EmbeddedViewRef<unknown>;
  repeaterId: string | null;
  groupId: string | null;
  sourceIds: Set<string>;
}

/** Keyed view retention and per-item state shared by virtual-scroll repeaters. */
@Injectable()
export class RecycleViewElementsState implements OnDestroy {
  private _stateMap = new Map<string, Record<string, unknown>>();
  private _stateSubjects = new Map<string, BehaviorSubject<Record<string, unknown> | undefined>>();
  private _detachedIds = new Set<string>();
  private _detachedViews = new Map<string, DetachedEntry>();
  private _detachChanges = new Subject<RecycleViewDetachEvent>();
  readonly detachChanges: Observable<RecycleViewDetachEvent> = this._detachChanges;

  add(id: string, state: Record<string, unknown>): void {
    const merged = {...this._stateMap.get(id), ...state};
    this._stateMap.set(id, merged);
    const subject = this._stateSubjects.get(id);
    if (subject) {
      subject.next(merged);
    } else {
      this._stateSubjects.set(id, new BehaviorSubject<Record<string, unknown> | undefined>(merged));
    }
  }

  get<T extends Record<string, unknown> = Record<string, unknown>>(id: string): T | undefined {
    return this._stateMap.get(id) as T | undefined;
  }

  has(id: string): boolean {
    return this._stateMap.has(id);
  }

  subscribe<T extends Record<string, unknown> = Record<string, unknown>>(
    id: string,
  ): Observable<T | undefined> {
    let subject = this._stateSubjects.get(id);
    if (!subject) {
      subject = new BehaviorSubject(this._stateMap.get(id));
      this._stateSubjects.set(id, subject);
    }
    return subject as Observable<T | undefined>;
  }

  remove(id: string, sourceId?: string): boolean {
    const removed = this._stateMap.delete(id);
    const subject = this._stateSubjects.get(id);
    if (subject) {
      subject.next(undefined);
      subject.complete();
      this._stateSubjects.delete(id);
    }
    this.unmarkForDetach(id, sourceId);
    this.removeDetachedViewsByRepeaterId(id);
    return removed;
  }

  markForDetach(id: string, sourceId?: string): void {
    if (sourceId !== undefined) {
      const entry = this._detachedViews.get(id);
      if (entry) {
        entry.sourceIds.add(sourceId);
        return;
      }
    }
    if (this._detachedIds.has(id)) return;
    this._detachedIds.add(id);
    this._detachChanges.next({type: 'mark', id});
    const entry = this._detachedViews.get(id);
    if (entry && sourceId) entry.sourceIds.add(sourceId);
  }

  unmarkForDetach(id: string, sourceId?: string): void {
    if (sourceId) {
      const entry = this._detachedViews.get(id);
      if (!entry) return;
      entry.sourceIds.delete(sourceId);
      if (entry.sourceIds.size) return;
    }
    this._detachedIds.delete(id);
    this._detachedViews.delete(id);
  }

  isMarkedForDetach(id: string): boolean {
    return this._detachedIds.has(id);
  }

  getDetachedIds(): string[] {
    return Array.from(this._detachedIds);
  }

  retainDetachedView(
    id: string,
    view: EmbeddedViewRef<unknown>,
    repeaterId: string | null = null,
    groupId: string | null = null,
  ): void {
    const previous = this._detachedViews.get(id);
    if (previous && previous.view !== view) previous.view.destroy();
    this._detachedViews.set(id, {
      view,
      repeaterId,
      groupId,
      sourceIds: new Set(previous?.sourceIds),
    });
  }

  takeDetachedView<T>(
    id: string,
  ): {view: EmbeddedViewRef<T>; repeaterId: string | null; groupId: string | null} | null {
    const entry = this._detachedViews.get(id);
    return entry
      ? {
          view: entry.view as EmbeddedViewRef<T>,
          repeaterId: entry.repeaterId,
          groupId: entry.groupId,
        }
      : null;
  }

  collectDetachedViews(collectDetached: string): void {
    this._detachChanges.next({type: 'collect', collectDetached});
  }

  notifyInsert(collectDetached: string): void {
    this._detachChanges.next({type: 'insert', collectDetached});
  }

  removeDetachedViewsByGroupId(groupId: string | null = null): void {
    this._removeDetachedViewsWhere((entry, id) => entry.groupId === groupId || id === groupId);
  }

  removeDetachedViewsByRepeaterId(repeaterId: string | null = null): void {
    this._removeDetachedViewsWhere(entry => entry.repeaterId === repeaterId);
  }

  private _removeDetachedViewsWhere(
    predicate: (entry: DetachedEntry, id: string) => boolean,
  ): void {
    this._detachedViews.forEach((entry, id) => {
      if (predicate(entry, id)) {
        this._detachedIds.delete(id);
        this._detachedViews.delete(id);
      }
    });
  }

  clear(): void {
    this._stateSubjects.forEach(subject => subject.complete());
    this._stateSubjects.clear();
    this._stateMap.clear();
    this._detachedIds.clear();
    this._detachedViews.forEach(entry => entry.view.destroy());
    this._detachedViews.clear();
    this._detachChanges.next({type: 'clear'});
  }

  ngOnDestroy(): void {
    this.clear();
    this._detachChanges.complete();
  }
}
