/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import 'zone.js';
import 'zone.js/testing';
import 'reflect-metadata';

import {ErrorHandler, NgModule, provideExperimentalZonelessChangeDetection} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

@NgModule({
  providers: [
    provideExperimentalZonelessChangeDetection(),
    {
      provide: ErrorHandler,
      useValue: {
        handleError: (error: unknown) => {
          throw error;
        },
      },
    },
  ],
})
export class TestModule {}

/*
 * Common setup / initialization for all unit tests in Angular Material and CDK.
 */
TestBed.initTestEnvironment(
  [BrowserDynamicTestingModule, TestModule],
  platformBrowserDynamicTesting(),
);

Object.assign(window, {
  module: {},
  isNode: false,
  isBrowser: true,
  global: window,
});

const manualTestFile = new URLSearchParams(window.location.search).get('wtr-test-file');

if (manualTestFile?.includes('wtr-manual-session=true')) {
  const originalConsoleLog = console.log.bind(console);

  console.log = (...values: unknown[]) => {
    if (values.length === 1 && typeof values[0] === 'string' && values[0].includes('\x1b[')) {
      for (const reportLine of values[0].replace(/\x1b\[[0-9;]*m/g, '').split('\n')) {
        originalConsoleLog(reportLine);
      }
      return;
    }

    originalConsoleLog(...values);
  };
}
