/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import {assertAbsolute} from '../src/cli_support';
import {getGeneratedExterns} from '../src/externs';
import {normalizeLineEndings} from '../src/jsdoc';
import * as tsickle from '../src/tsickle';

import * as testSupport from './test_support';

// Set TEST_FILTER=foo to only run tests from the foo package.
// Set TEST_FILTER=foo/bar to also filter for the '/bar' file.
const TEST_FILTER = (() => {
  if (!process.env['TEST_FILTER']) return null;
  const [testName, fileName] = (process.env['TEST_FILTER'] as string).split('/', 2);
  return {
    testName: new RegExp(testName + (fileName ? '$' : '')),
    fileName: fileName ? new RegExp('/' + fileName) : null
  };
})();

// If true, update all the golden .js files to be whatever tsickle
// produces from the .ts source. Do not change this code but run as:
//     UPDATE_GOLDENS=y bazel run test:golden_test
const UPDATE_GOLDENS = !!process.env['UPDATE_GOLDENS'];

/**
 * compareAgainstGoldens compares a test output against the content in a golden
 * path, updating the content of the golden when UPDATE_GOLDENS is true.
 *
 * @param output The expected output, where the empty string indicates
 *     the file is expected to exist and be empty, while null indicates
 *     the file is expected to not exist.  (This subtlety is used for
 *     externs files, where the majority of tests are not expected to
 *     produce one.)
 * @param goldenPath The absolute path to the matching golden file.
 */
function compareAgainstGolden(
    output: string|null, goldenPath: string, test: testSupport.GoldenFileTest) {
  let golden: string|null = null;
  try {
    golden = fs.readFileSync(goldenPath, 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT' && (UPDATE_GOLDENS || output === null)) {
      // A missing file is acceptable if we're updating goldens or
      // if we're expected to produce no output.
    } else {
      throw e;
    }
  }

  // Make sure we have proper line endings when testing on Windows.
  if (golden != null) golden = normalizeLineEndings(golden);
  if (output != null) output = normalizeLineEndings(output);

  if (UPDATE_GOLDENS && output !== golden) {
    // Ensure goldenPath refers to the path within the original source root, and not some
    // testing environment symlink.
    goldenPath = fs.readlinkSync(goldenPath);
    console.log('Updating golden file for', goldenPath);
    if (output !== null) {
      fs.writeFileSync(goldenPath, output, {encoding: 'utf-8'});
    } else {
      // The desired golden state is for there to be no output file.
      // Ensure no file exists.
      try {
        fs.unlinkSync(goldenPath);
      } catch (e) {
        // ignore.
      }
    }
  } else {
    expect(output).toEqualWithDiff(golden!);
  }
}

// Only run golden tests if we filter for a specific one.
const testFn = TEST_FILTER ? fdescribe : describe;

testFn('golden tests', () => {
  beforeEach(() => {
    testSupport.addDiffMatchers();
  });

  for (const test of testSupport.goldenTests()) {
    if (TEST_FILTER && !TEST_FILTER.testName.test(test.name)) {
      // do not xit(test.name) as that spams a lot of useless console msgs.
      continue;
    }
    let emitDeclarations = true;
    if (test.name === 'fields') {
      emitDeclarations = false;
    }
    it(test.name, () => {
      const inputPaths = test.inputPaths();
      expect(inputPaths.length).toBeGreaterThan(0);

      // Read all the inputs into a map, and create a ts.Program from them.
      const tsSources = new Map<string, string>();
      for (const tsPath of inputPaths) {
        let tsSource = fs.readFileSync(tsPath, 'utf-8');
        tsSource = normalizeLineEndings(tsSource);
        tsSources.set(tsPath, tsSource);
      }
      const tsCompilerOptions: ts.CompilerOptions = {
        ...testSupport.compilerOptions,
        // Test that creating declarations does not throw
        declaration: emitDeclarations,
      };
      const {program, host: tsHost} =
          testSupport.createProgramAndHost(tsSources, tsCompilerOptions);
      {
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length) {
          throw new Error(testSupport.formatDiagnostics(diagnostics));
        }
      }
      if (test.isEs5Target) {
        tsCompilerOptions.target = ts.ScriptTarget.ES5;
      }
      const allDiagnostics = new Set<ts.Diagnostic>();
      const transformerHost: tsickle.TsickleHost = {
        es5Mode: test.isEs5Target,
        googmodule: true,
        // See test_files/jsdoc_types/nevertyped.ts and
        // test_files/blacklisted_ambient_external_module/blacklisted.d.ts
        typeBlackListPaths: new Set([
          path.join(
              tsCompilerOptions.rootDir!,
              'test_files/jsdoc_types/nevertyped.ts'),
          path.join(
              tsCompilerOptions.rootDir!,
              'test_files/blacklisted_ambient_external_module/blacklisted.d.ts'),
        ]),
        convertIndexImportShorthand: true,
        transformDecorators: !test.isPureTransformerTest,
        transformTypesToClosure: !test.isPureTransformerTest,
        // Setting this to true matches how we typically run Clutz, but note
        // that the Clutz pass only affects output d.ts files, which in this
        // test suite are only produced for "declaration" tests (tests where
        // test.isDeclarationTest is true).
        addDtsClutzAliases: true,
        untyped: test.isUntypedTest,
        provideExternalModuleDtsNamespace: !test.hasShim,
        logWarning: (diag: ts.Diagnostic) => {
          allDiagnostics.add(diag);
        },
        shouldSkipTsickleProcessing: (fileName) => !tsSources.has(fileName),
        shouldIgnoreWarningsForPath: () => false,
        pathToModuleName: (context, importPath) => {
          return testSupport.pathToModuleName(tsCompilerOptions.rootDir!, context, importPath);
        },
        fileNameToModuleId: (fileName) => {
          assertAbsolute(fileName);
          fileName = path.relative(tsCompilerOptions.rootDir!, fileName);
          return fileName.replace(/^\.\//, '');
        },
        options: tsCompilerOptions,
        moduleResolutionHost: tsHost,
      };

      const tscOutput = new Map<string, string>();
      let targetSource: ts.SourceFile|undefined = undefined;
      if (TEST_FILTER && TEST_FILTER.fileName) {
        for (const [path] of tsSources.entries()) {
          if (!TEST_FILTER.fileName.test(path)) continue;
          if (targetSource) {
            throw new Error(
                `TEST_FILTER matches more than one file: ${targetSource.fileName} vs ${path}`);
          }
          targetSource = program.getSourceFile(path);
        }
        if (!targetSource) {
          throw new Error(`TEST_FILTER matched no file: ${TEST_FILTER.fileName} vs ${
              Array.from(tsSources.keys())}`);
        }
      }

      /** Returns true if we test the emitted output for the given path. */
      function shouldCompareOutputToGolden(fileName: string): boolean {
        // For regular tests we only check .js files, while for declaration
        // tests we only check .d.ts files.
        if (test.isDeclarationTest) {
          return fileName.endsWith('.d.ts');
        }
        return fileName.endsWith('.js');
      }

      const {diagnostics, externs} = tsickle.emit(
          program, transformerHost, (fileName: string, data: string) => {
            if (shouldCompareOutputToGolden(fileName)) {
              tscOutput.set(fileName, data);
            }
          }, targetSource);
      for (const d of diagnostics) allDiagnostics.add(d);
      const diagnosticsByFile = new Map<string, ts.Diagnostic[]>();
      for (const d of allDiagnostics) {
        const fileName = d.file?.fileName ?? 'unhandled diagnostic with no file name attached';
        let diags = diagnosticsByFile.get(fileName);
        if (!diags) diagnosticsByFile.set(fileName, diags = []);
        diags.push(d);
      }
      if (!test.isDeclarationTest) {
        const sortedPaths = test.jsPaths().sort();
        const actualPaths = Array.from(tscOutput.keys()).map(p => p.replace(/^\.\//, '')).sort();
        expect(sortedPaths).toEqual(actualPaths, `${test.jsPaths} vs ${actualPaths}`);
      }
      let allExterns: string|null = null;
      if (!test.name.endsWith('.no_externs')) {
        // Concatenate externs for the files that are in this tests sources (but not other, shared
        // .d.ts files).
        const filteredExterns: {[k: string]: string} = {};
        let anyExternsGenerated = false;
        for (const fileName of tsSources.keys()) {
          if (externs[fileName]) {
            anyExternsGenerated = true;
            filteredExterns[fileName] = externs[fileName];
          }
        }
        if (anyExternsGenerated) {
          allExterns = getGeneratedExterns(filteredExterns, tsCompilerOptions.rootDir!);
        }
      }
      compareAgainstGolden(allExterns, test.externsPath(), test);
      for (const [outputPath, output] of tscOutput) {
        const tsPath = outputPath.replace(/\.js$|\.d.ts$/, '.ts').replace(/^\.\//, '');
        const diags = diagnosticsByFile.get(tsPath);
        diagnosticsByFile.delete(tsPath);
        let out = output;
        if (diags) {
          out = testSupport.formatDiagnostics(diags)
                    .trim()
                    .split('\n')
                    .map(line => `// ${line}\n`)
                    .join('') +
              out;
        }
        compareAgainstGolden(out, outputPath, test);
      }
      const dtsDiags: ts.Diagnostic[] = [];
      if (diagnosticsByFile.size) {
        for (const [path, diags] of diagnosticsByFile.entries()) {
          if (path.endsWith('.d.ts')) {
            dtsDiags.push(...diags);
            continue;
          }
          expect(testSupport.formatDiagnostics(diags))
              .toBe('', `unhandled diagnostics for ${path}`);
        }
      }
      if (dtsDiags.length) {
        compareAgainstGolden(
            testSupport.formatDiagnostics(dtsDiags),
            path.join(test.root, 'dtsdiagnostics.txt'), test);
      }
    });
  }
});
