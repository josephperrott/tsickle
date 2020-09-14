// Mocks for Clutz-generated .d.ts.

// A plain module containing a default export.
declare namespace ಠ_ಠ.clutz.my.module {
  class MyClassDefaultExport {
    someField: number;
  }
}
declare module 'goog:my.module' {
import MyClassDefaultExport = ಠ_ಠ.clutz.my.module.MyClassDefaultExport;
  export default MyClassDefaultExport;
}
declare module 'google3/path/to/file' {
import MyClassDefaultExport = ಠ_ಠ.clutz.my.module.MyClassDefaultExport;
  // Note: default export converted to a named export below.
  export {MyClassDefaultExport};
  const __clutz_actual_namespace: 'my.module';
  const __clutz_strip_property: 'MyClassDefaultExport';
}

// A module containing a named export.
declare namespace ಠ_ಠ.clutz.other.module {
  function someFunction(x: number): number;
}
declare module 'goog:other.module' {
import module = ಠ_ಠ.clutz.other.module;
  export = module;
}
declare module 'google3/path/to/otherfile' {
import someFunction = ಠ_ಠ.clutz.other.module.someFunction;
  export {someFunction};
  const __clutz_actual_namespace: 'other.module';
}

// A module export a (named) type.
declare namespace ಠ_ಠ.clutz.type.module {
  type SomeType = number;
}
declare module 'goog:type.module' {
import SomeType = ಠ_ಠ.clutz.type.module.SomeType;
  export {SomeType};
}
declare module 'google3/path/to/typeonly' {
import SomeType = ಠ_ಠ.clutz.type.module.SomeType;
  export {SomeType};
  const __clutz_actual_namespace: 'type.module';
}

// A module containing multiple provides.
// This models Clutz' emit, the key element is the __clutz_multiple_provides.
declare namespace ಠ_ಠ.clutz.multiple.provides {
  const value: number;
}
declare module 'goog:multiple.provides' {
import value = ಠ_ಠ.clutz.multiple.provides.value;
  export {value};
}
declare module 'google3/path/to/multiple_provides' {
import value = ಠ_ಠ.clutz.multiple.provides.value;
  export {value};
  const __clutz_actual_namespace: 'multiple.provides';
}
declare namespace ಠ_ಠ.clutz.multiple.provides.nested {
  const value2: number;
}
declare module 'goog:multiple.provides.nested' {
import value2 = ಠ_ಠ.clutz.multiple.provides.nested.value2;
  export {value2};
}
declare module 'google3/path/to/multiple_provides' {
  export {};
  // NB: nested namespaces do not get their own toplevel exports.
  const __clutz_multiple_provides: true;
}
