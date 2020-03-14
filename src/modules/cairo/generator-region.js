/*
 * generator-region.js
 */

const fs = require('fs')
const path = require('path')
const util = require('util')
const removeTrailingSpaces = require('remove-trailing-spaces')
const { indent, unindent } = require('./indent.js')

util.inspect.defaultOptions = { depth: 6 }

const {
  generateClassMethodSource,
  generateSource,
  parseFile,
  getJSName,
} = require('./generator.js')


const options = {
  name: 'Region',
  constructor: undefined,
  functions: undefined,
  isBase: true,
  type: 'cairo_region_t',
  prefix: /cairo_[a-z0-9]+(_region)?/,
  create: 'cairo_region_create',
  destroy: 'cairo_region_destroy',
  filename: __filename,
  dependencies: [
    'region.h',
    'rectangle.h',
    'rectangle-int.h',
  ],
}



generateCairoRegion()

function generateCairoRegion() {
  const result = parseFile(path.join(__dirname, 'region.nid'))
  const declarations = result.declarations

  options.constructor = declarations.find(d => d.function && d.function.attributes.constructor).function
  options.functions =
    declarations
      .filter(d => d.function && d.function.attributes.constructor !== true)
      .map(d => {
        const fn = d.function
        fn.source = generateClassMethodSource(fn, options)
        return fn
      })

  /* functions.forEach(fn => {
   *   console.log({ ...fn, source: undefined })
   *   console.log(fn.source)
   *   console.log('')
   * }) */

  const header = generateHeader(options)
  const source = generateSource(options, [options])

  fs.writeFileSync(path.join(__dirname, 'region.h'),  header)
  fs.writeFileSync(path.join(__dirname, 'region.cc'), source)
}

// Helpers

function generateHeader(options) {
  const classDeclaration = generateClassDeclaration(options)

  return removeTrailingSpaces(unindent(`

    /* autogenerated by ${path.basename(__filename)} */

    #pragma once

    #include <nan.h>
    #include <node.h>
    #include <girepository.h>
    #include <glib.h>
    #include <cairo.h>

    namespace GNodeJS {

    namespace Cairo {

    ${classDeclaration}

    }; // Cairo

    }; // GNodeJS

  `))
}

function generateClassDeclaration(options) {

  return `
    class ${options.name}: public Nan::ObjectWrap {
      public:
        static Nan::Persistent<v8::FunctionTemplate> constructorTemplate;
        static Nan::Persistent<v8::Function>         constructor;
        static void Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target);
        static void SetupTemplate();
        static Local<v8::FunctionTemplate> GetTemplate();
        static Local<v8::Function> GetConstructor();

        static NAN_METHOD(New);

        ${options.functions.map(fn => `static NAN_METHOD(${getJSName(fn.name, options.prefix)});`).join('\n        ')}

        ${options.name}(${options.type}* data);
        ~${options.name}();

        ${options.type}* _data;
    };
  `
}