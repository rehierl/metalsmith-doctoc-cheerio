
"use strict;"

const is = require("is");
const util = require("util");

const Options = require("./Options.js");

const cheerio = require("cheerio");

module.exports = Plugin;

//========//========//========//========//========//========//========//========

function Plugin(userOptions) {
  if(!(this instanceof Plugin)) {
    return new Plugin(userOptions);
  }

  //- used as default/base options when
  //  applying plugin-specific settings
  this.options = new Options();
  this.options.combine(userOptions);

  //- used as default/base options when
  //  applying file-specific settings
  this.optionsDefault = this.options;

  //- used when processing a file
  this.optionsFile = this.options;

  //- MDT's plugins API
  this.api = undefined;
}

//========//========//========//========//========//========//========//========

//- public, optional
Plugin.prototype.setPluginsApi = function(api) {
  this.api = api;
};

//========//========//========//========//========//========//========//========

//- public, not required
//- warning if needed and missing
Plugin.prototype.setDefaultOptions = function(options) {
  const clone = this.options.clone();
  clone.combine(options);
  this.optionsDefault = clone;
};

//========//========//========//========//========//========//========//========

//- public, not required
//- warning if needed and missing
Plugin.prototype.setFileOptions = function(filename, options) {
  const clone = this.optionsDefault.clone();
  clone.combine(options);
  clone.filename = filename;
  this.optionsFile = clone;
};

//========//========//========//========//========//========//========//========

//- public, required
Plugin.prototype.run = function(filename, file) {
  let options = undefined;

  {//## choose which options to use
    options = this.optionsFile;

    if(!options.hasOwnProperty("filename")) {
      options = this.optionsDefault;
    } else if(options.filename !== filename) {
      options = this.optionsDefault;
    }

    //- file options should only be used for a single file
    //- reset file options to the default options
    this.optionsFile = this.optionsDefault;
  }

  return this.api.readFileContents(readContents, {
    api: this.api,
    filename: filename,
    file: file,
    options: options
  });
};

//========//========//========//========//========//========//========//========

function readContents(context) {
  const api = context.api;
  const contents = context.contents;
  const options = context.options;

  const idgen = api.getIdGenerator({
    slugFunc: options.slugFunc,
    idPrefix: options.idPrefix,
    idLengthLimit: options.idLengthLimit
  });

  const $ = cheerio.load(contents, options.htmlparser2);

  const headings = [];
  let newIdsCount = 0;

  const hSelector = options.hSelector;
  const hContext = options.hContext;

  $(hSelector, $(hContext)).each(function(index, element) {
    const title = $(element).text();
    let id = $(element).attr("id");

    if(id === undefined) {
      id = idgen.nextId(title);

      if(options.makeIdsUnique === true) {
        while($("*").is("#" + id)) {
          id = idgen.nextId();
        }
      }

      $(element).attr("id", id);
      newIdsCount++;
    }

    const tag = element.tagName;
    const level = Number.parseInt(tag.substring(1));

    headings.push({
      tag: tag,
      level: level,
      title: title,
      id: id
    });
  });

  if((options.alwaysUpdate !== true)
  && (newIdsCount <= 0)) {
    delete context.contents;
  } else {
    context.contents = $.html();
  }

  return api.createTreeFromHeadings(headings);
}
