/**
 * @fileoverview Negative test: this TS file attempts to import a JS module that provides multiple
 * namespaces by path, which is an error.
 */

import {value} from 'google3/path/to/multiple_provides';
console.error(value);