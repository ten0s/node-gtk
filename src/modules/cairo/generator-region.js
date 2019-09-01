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
  getClassMethodSource,
  getInArgumentSource,
  parseFile,
  getJSName,
} = require('./generator.js')


const options = {
  name: 'Region',
  type: 'cairo_region_t',
  prefix: /cairo_[a-z0-9]+(_region)?/,
  constructor: undefined,
  functions: undefined
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
        fn.source = getClassMethodSource(fn, options)
        return fn
      })

  /* functions.forEach(fn => {
   *   console.log({ ...fn, source: undefined })
   *   console.log(fn.source)
   *   console.log('')
   * }) */

  const header = generateHeader(options)
  const source = generateSource(options)

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

function generateSource(options) {

  const classVariables   = generateClassVariables(options)
  const templateMethods  = generateTemplateMethods(options)
  const initializeMethod = generateInitializeMethod(options)
  const newMethod        = generateNewMethod(options)
  const methods          = options.functions.map(fn => fn.source).join('\n')

  return removeTrailingSpaces(unindent(`

    /* autogenerated by ${path.basename(__filename)} */

    #include "../../debug.h"
    #include "../../gi.h"
    #include "../../util.h"
    #include "region.h"
    #include "rectangle.h"
    #include "rectangle-int.h"

    using namespace v8;


    namespace GNodeJS {

    namespace Cairo {


    ${classVariables}


    /*
     * Initialize region.
     */

    ${options.name}::${options.name}(${options.type}* data) : ObjectWrap() {
      _data = data;
    }

    /*
     * Destroy region..
     */

    ${options.name}::~${options.name}() {
      if (_data != NULL) {
        cairo_region_destroy (_data);
      }
    }


    /*
     * Template methods
     */

    ${templateMethods}


    /*
     * Initialize method
     */

    ${initializeMethod}


    /*
     * Instance constructors
     */

    ${newMethod}


    /*
     * Methods
     */

    ${methods}



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

function generateClassVariables(options) {
  return `
    Nan::Persistent<FunctionTemplate> ${options.name}::constructorTemplate;
    Nan::Persistent<Function>         ${options.name}::constructor;
  `
}

function generateTemplateMethods(options) {

  const staticMethods = options.functions.filter(fn => fn.attributes.static)
  const methods = options.functions.filter(fn => fn.attributes.static !== true)

  return `
    Local<FunctionTemplate> ${options.name}::GetTemplate() {
      if (constructorTemplate.IsEmpty())
        ${options.name}::SetupTemplate();
      return Nan::New<FunctionTemplate> (constructorTemplate);
    }

    Local<Function> ${options.name}::GetConstructor() {
      if (constructor.IsEmpty())
        ${options.name}::SetupTemplate();
      return Nan::New<Function> (constructor);
    }

    void ${options.name}::SetupTemplate() {

      // Constructor
      auto tpl = Nan::New<FunctionTemplate>(${options.name}::New);
      tpl->InstanceTemplate()->SetInternalFieldCount(1);
      tpl->SetClassName(Nan::New("Cairo${options.name}").ToLocalChecked());

      ${methods.map(fn => {
        const jsName = getJSName(fn.name, options.prefix)
        if (!jsName.endsWith('_'))
          return `SET_PROTOTYPE_METHOD(tpl, ${jsName});`
        const methodName = jsName.slice(0, -1)
        return `Nan::SetPrototypeMethod(tpl, "${methodName}", ${jsName});`
      }).join('\n      ')}

      auto ctor = Nan::GetFunction (tpl).ToLocalChecked();

      ${staticMethods.map(fn => `SET_METHOD(ctor, ${getJSName(fn.name, options.prefix)});`).join('\n      ')}

      constructorTemplate.Reset(tpl);
      constructor.Reset(ctor);
    }
  `
}

function generateInitializeMethod(options) {
  return `
    void ${options.name}::Initialize(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target) {
      Nan::Set (target, Nan::New ("${options.name}").ToLocalChecked(), ${options.name}::GetConstructor());
    }
  `
}

function generateNewMethod(options) {
  const constructor = options.constructor
  const parameters = constructor.parameters

  return `

    NAN_METHOD(${options.name}::New) {
      if (!info.IsConstructCall()) {
        return Nan::ThrowTypeError("Class constructors cannot be invoked without 'new'");
      }

      ${options.type}* data = NULL;

      if (info[0]->IsExternal()) {
        data = (${options.type}*) External::Cast (*info[0])->Value ();
      }
      else if (info.Length() == 1) {
        ${parameters.map(getInArgumentSource).join('\n        ')}

        data = ${constructor.name} (${parameters.map(p => p.name).join(', ')});
      }
      else {
        data = cairo_region_create ();
      }

      ${options.name}* region = new ${options.name}(data);
      region->Wrap(info.This());

      info.GetReturnValue().Set(info.This());
    }
  `
}
