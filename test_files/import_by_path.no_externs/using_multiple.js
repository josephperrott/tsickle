// test_files/import_by_path.no_externs/using_multiple.ts(6,21): error TS0: referenced JavaScript module google3/path/to/multiple_provides provides multiple namespaces and cannot be imported by path.
/**
 *
 * @fileoverview Negative test: this TS file attempts to import a JS module that provides multiple
 * namespaces by path, which is an error.
 *
 * Generated from: test_files/import_by_path.no_externs/using_multiple.ts
 * @suppress {checkTypes,constantProperty,extraRequire,missingOverride,missingRequire,missingReturn,unusedPrivateMembers,uselessCode} checked by tsc
 */
goog.module('test_files.import_by_path.no_externs.using_multiple');
var module = module || { id: 'test_files/import_by_path.no_externs/using_multiple.ts' };
goog.require('tslib');
const tsickle_multiple_provides_1 = goog.requireType("multiple.provides");
const multiple_provides_1 = goog.require('multiple.provides');
console.error(multiple_provides_1.value);
