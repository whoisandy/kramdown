var isMac =  /Mac/.test(navigator.platform);

var shortcuts = {
  bold: 'Cmd-B',
  italic: 'Cmd-I',
  strike: 'Cmd-.',
  heading: 'Cmd-Alt-.',
  quote: 'Cmd-\'',
  ul: 'Cmd-L',
  ol: 'Cmd-Alt-L',
  indent: 'Cmd-]',
  outdent: 'Cmd-[',
  code: 'Cmd-\/',
  link: 'Cmd-K',
  image: 'Cmd-Alt-I',
  video: 'Cmd-Alt-V'
};

var buttonNames = {
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strike',
  heading: 'Heading',
  quote: 'Blockquote',
  ul: 'Unordered List',
  ol: 'Ordered List',
  indent: 'Indent',
  outdent: 'Outdent',
  code: 'Code',
  link: 'Link',
  image: 'Image',
  video: 'Video'
};

var defaults = {
  el: '',
  toolbar: true,
  statusbar: true,
  buttons: ['bold', 'italic', 'strike', 'heading', 'quote', 'ul', 'ol', 'indent', 'outdent', 'code', 'link', 'image', 'video'],
  status: ['lines', 'words', 'chars', 'cursor'],
  shortcutBtns: shortcuts,
  plugins: false

  // functionality to add external functionality as adding modals
  // dialogs, overlays, etc, include in the library only.
  // make no dependencies other than codemirror and marked
};

function hasClass(elem, className) {
  return new RegExp(' ' + className + ' ').test(' ' + elem.className + ' ');
}

function addClass(elem, className) {
  if(elem.className === ''){
    elem.className = className;
  } else if (!hasClass(elem, className)) {
    elem.className += ' ' + className;
  }
}

function removeClass(elem, className) {
  var newClass = ' ' + elem.className.replace(/[\t\r\n]/g, ' ') + ' ';
  if (hasClass(elem, className)) {
    while (newClass.indexOf(' ' + className + ' ') >= 0) {
      newClass = newClass.replace(' ' + className + ' ', ' ');
    }
    elem.className = newClass.replace(/^\s+|\s+$/g, '');
  }
}

function addAttr(elem, name, val){
  elem.setAttribute(name, val);
}

function removeAttr(elem, name){
  elem.removeAttribute(name);
}

// TODO: Use this when integrating localStorage
// feature built right into the editor.
function val(el, val){
  if(val === undefined){
    return el.value;
  }
  el.value = val;
}

function offset(elem){
  var off = {};
  off.left = elem.offsetLeft;
  off.top = elem.offsetTop;

  return off;
}

function innerHeight(elem){
  return elem.offsetHeight;
}

function innerWidth(elem){
  return elem.offsetWidth;
}

function position(parent, child){
  var pos = {};
  pos.left = (offset(parent).left - (innerWidth(child) - innerWidth(parent))/2) + 'px';
  pos.top = (offset(parent).top - (innerHeight(child) - innerHeight(parent))/2) + 'px';

  return pos;
}

function extendObj(){
  for(var i=1; i<arguments.length; i++){
    for(var key in arguments[i]){
      if(arguments[i].hasOwnProperty(key))
      {
        arguments[0][key] = arguments[i][key];
      }
    }
  }
  return arguments[0];
}

function emptyObj(o){
  for(var prop in o){
    if(o.hasOwnProperty(prop)){
      return false;
    }
  }
  return true;
}

function fixToolbarShortcut(text){
  if (isMac) {
    text = text.replace('Ctrl', 'Cmd');
  } else {
    text = text.replace('Cmd', 'Ctrl');
  }
  return text;
}

function mapToolbarShortcut(keyMaps, key, kd){
  keyMaps[fixToolbarShortcut(shortcuts[key])] = function () {
    kd._action(key);
  };
}

function action(e){
  var context = e.target.context;
  var name = e.target.name;

  context._action(name);
}

function getState(cm){
  var pos, end;
  pos = pos || cm.getCursor('from');
  end = end || cm.getCursor('to');
  var stat = cm.getTokenAt(pos, true);

  if(/^\s*(\*|\-|\+|\d+\.)\s/.test(cm.getRange(pos, end)) && cm.getLine(pos.line-1)){
    stat.type = 'variable-2';
  }

  if (!stat.type){
    return {};
  }
  var ret = {}, data, types;
  types = stat.type.split(' ');
  for (var i = 0; i < types.length; i++) {
    data = types[i];
    switch(data){
      case 'strong':
        ret.bold = true;
        break;
      case 'em':
        ret.italic = true;
        break;
      case 'strike':
        ret.strike = true;
        break;
      case 'header':
        ret.heading = true;
        break;
      case 'quote':
        ret.quote = true;
        break;
      case 'link':
        ret.link = true;
        break;
      case 'tag':
        ret.image = true;
        break;
      case 'variable-2':
        var text = cm.getLine(pos.line);
        if (/^\s*\d+\.\s/.test(text)) {
          ret['ol'] = true;
        } else {
          ret['ul'] = true;
        }
        break;
      default:
        break;
    }
  }
  return ret;
}

function getParams(args){
  var obj = {};
  obj.cm = args[1];
  obj.name = args[2];
  obj.state = getState(args[1]);
  obj.instate = obj.state[obj.name] || false;
  obj.start = args[3];
  obj.end = args[4];
  obj.startPoint = args[1].getCursor('from');
  obj.endPoint = args[1].getCursor('to');

  return obj;
}

var replaceAction = function(args){
  console.log('debugging replace action...');
  var params = getParams(args);
  var cm = params.cm;
  var start = params.startPoint, end = params.endPoint;
  var selection = cm.getSelection(), nstart = {}, nend = {}, ssel = {}, esel = {};

  nstart.line = nend.line = start.line;
  ssel.line = esel.line = start.line;
  params.end === null ? params.end = '' : params.end = params.end || params.start;

  var text = cm.getLine(start.line);
  var stext = text.slice(0, start.ch);
  var etext = text.slice(start.ch);
  var slen;

  switch (params.name) {
    case 'bold':
      stext = stext.replace(/^(.*)?(\*|_){2}(\S+.*)?$/, '$1$3');
      etext = etext.replace(/^(.*\S+)(\*|_){2}(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 2) : nstart.ch = start.ch + 2;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 2) : nend.ch = end.ch + 2;
      break;
    case 'italic':
      stext = stext.replace(/^(.*)?(\*|_)(\S+.*)?$/, '$1$3');
      etext = etext.replace(/^(.*\S+)?(\*|_)(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 1) : nstart.ch = start.ch + 1;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 1) : nend.ch = end.ch + 1;
      break;
    case 'strike':
      stext = stext.replace(/^(.*)?(~){2}(\S+.*)?$/, '$1$3');
      etext = etext.replace(/^(.*\S+)(~){2}(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 2) : nstart.ch = start.ch + 2;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 2) : nend.ch = end.ch + 2;
      break;
    case 'heading':
      slen = stext.length;
      selection = text;
      stext = stext.replace(/^(.*)?(#\s?){2}(\S+.*)?/, '$1$3');
      etext = etext.replace(/^(.*\S+)?(\s?#){2}(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch + stext.length - slen) : (nstart.ch = 0, ssel.ch = start.ch + 3);
      params.instate ? (nend.ch = text.length, esel.ch = end.ch + stext.length - slen) : (nend.ch = text.length, esel.ch = end.ch + 3);
      break;
    case 'quote':
      slen = stext.length;
      selection = text;
      stext = stext.replace(/^(.*)?(>\s?)(\S+.*)?/, '$1$3');
      etext = etext.replace(/^(.*\S+)?(\s?)(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch + stext.length - slen) : (nstart.ch = 0, ssel.ch = start.ch + 2);
      params.instate ? (nend.ch = text.length, esel.ch = end.ch + stext.length - slen): (nend.ch = text.length, esel.ch = end.ch + 2);
      break;
    case 'ul':
      var i, ul, nul = [];
      ul = selection.split('\n');
      if(params.instate){
        for(i = 0 ; i < ul.length; i ++){
          nul[i] = ul[i].replace(/^(\s*)(\*|\-|\+)\s+/, '$1');
        }
      } else {
        for(i = 0; i < ul.length; i++){
          nul[i] = params.start + ul[i].replace(/^(\s*)(\d+\.)\s+/, '');
        }
      }
      text = nul.join('\n');
      params.instate ? (nstart.ch = 0, ssel.line = start.line, ssel.ch = start.ch) : (nstart.ch = start.ch + selection.length, ssel.line = start.line, ssel.ch = start.ch);
      params.instate ? (nend.ch = selection.length, esel.line = end.line, esel.ch = end.ch) : (nend.ch = end.ch + params.end.length, esel.line = end.line, esel.ch = end.ch + params.start.length);
      break;
    case 'ol':
      var j, ol, nol = [];
      ol = selection.split('\n');
      if(params.instate){
        for(j = 0 ; j < ol.length; j ++){
          nol[j] = ol[j].replace(/^(\s*)(\d+\.)\s+/, '$1');
        }
      } else {
        for(j = 0; j < ol.length; j++){
          nol[j] = 1 + j + '. ' + ol[j].replace(/^(\s*)(\*|\-|\+)\s+/, '');
        }
      }
      text = nol.join('\n');
      params.instate ? (nstart.ch = 0, ssel.line = start.line, ssel.ch = start.ch) : (nstart.ch = start.ch + selection.length, ssel.line = start.line, ssel.ch = start.ch);
      params.instate ? (nend.ch = selection.length, esel.line = end.line, esel.ch = end.ch) : (nend.ch = end.ch + params.end.length, esel.line = end.line, esel.ch = end.ch + params.start.length);
      break;
    case 'indent':
      cm.execCommand('indentMore');
      break;
    case 'outdent':
      cm.execCommand('indentLess');
      break;
    case 'link':
      stext = stext.replace(/(.*)?(\[)(\S+.*)?/, '$1');
      etext = etext.replace(/(]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.?[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\))(\s+.*)?/, '$2');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 1) : nstart.ch = start.ch + selection.length + 3;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 1) : nend.ch = end.ch + params.end.length;
      break;
    case 'image':
      stext = stext.replace(/(.*)?(!\[)(\S+.*)?/, '$1');
      etext = etext.replace(/(]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.?[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\))(\s+.*)?/, '$2');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 2) : nstart.ch = start.ch + selection.length + 4;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 2) : nend.ch = end.ch + params.end.length + 1;
      break;
    default:
      break;
  }

  if (params.name === 'indent' || params.name === 'outdent'){
    cm.focus();
    return;
  }

  if (params.instate){
    if (params.name === 'ul' || params.name === 'ol'){
      cm.replaceSelection(text, 'around');
      cm.setSelection(ssel, esel);
    } else {
      cm.replaceRange(stext + etext, nstart, nend);
      cm.setSelection(ssel, esel);
    }
  } else {
    if (params.name === 'heading' || params.name === 'quote'){
      cm.replaceRange(params.start + selection + params.end, nstart, nend);
      cm.setSelection(ssel, esel);
    } else if (params.name === 'ul' || params.name === 'ol') {
      cm.replaceSelection(text, 'around');
      cm.setSelection(ssel, esel);
    } else {
      cm.replaceSelection(params.start + selection + params.end, 'around');
      cm.setSelection(nstart, nend);
    }
  }

  cm.focus();
  return;
};

var toggleAction = function(args){
  console.log('debugging toggle action...');
  var params = getParams(args);
  var cm = params.cm;
  var start = params.startPoint, end = params.endPoint;
  var nstart = {}, nend = {}, scur = {}, ecur = {};

  nstart.line = nend.line = start.line;
  scur.line = ecur.line = start.line;
  params.end === null ? params.end = '' : params.end = params.end || params.start;

  var text = cm.getLine(start.line);
  var stext = text.slice(0, start.ch);
  var etext = text.slice(start.ch);

  switch(params.name){
    case 'bold':
      stext = stext.replace(/(\*|_){2}/, '');
      etext = etext.replace(/(\*|_){2}/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - 2) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch ): nend.ch = end.ch + params.end.length;
      break;
    case 'italic':
      stext = stext.replace(/(\*|_)/, '');
      etext = etext.replace(/(\*|_)/, '');
      params.instate ? (nstart.ch = 0, scur = start.ch - 1) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch) : nend.ch = end.ch + params.end.length;
      break;
    case 'strike':
      stext = stext.replace(/(~){2}/, '');
      etext = etext.replace(/(~){2}/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - 2) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch ): nend.ch = end.ch + params.end.length;
      break;
    case 'heading':
      stext = stext.replace(/(#){2}(\s?)/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - 3) : nstart.ch = start.ch + params.start.length;
      break;
    case 'quote':
      stext = stext.replace(/(>\s+)/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - 2) : nstart.ch = start.ch + params.start.length;
      break;
    case 'ul':
      if (start.ch > 2) return;
      stext = stext.replace(/(\s*)(\*|\-|\+)\s+/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch) : nstart.ch = start.ch + params.start.length;
      break;
    case 'ol':
      if(start.ch > 3) return;
      stext = stext.replace(/(\s*)(\d\.)\s+/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch) : nstart.ch = start.ch + params.start.length;
      break;
    case 'indent':
      cm.execCommand('indentMore');
      break;
    case 'outdent':
      cm.execCommand('indentLess');
      break;
    case 'link':
      stext = stext.replace(/(\[)/, '');
      etext = etext.replace(/]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.?[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\)/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - params.start.length) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch) : nend.ch = end.ch + params.end.length;
      break;
    case 'image':
      stext = stext.replace(/!\[/, '');
      etext = etext.replace(/]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.?[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\)/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - params.start.length) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur = end.ch) : nend.ch = end.ch + params.end.length;
      break;
    case 'video':
      break;
    default:
      break;
  }

  if(params.name === 'indent' || params.name === 'outdent'){
    cm.focus();
    return;
  }

  if(params.instate){
    cm.replaceRange(stext + etext, nstart, nend);
    cm.setCursor(scur);
  } else {
    cm.replaceRange(params.start + '' + params.end, start, end);
    cm.setCursor(nstart, nend);
  }

  cm.focus();
  return;
};

// Kramdown constructor
function Kramdown(config){
  var cfg, options;
  cfg = this._merge(config);
  options = this.options = extendObj({}, defaults, cfg);
  if(!options.el){
    throw new Error('Kramdown requires atleast one textarea element to initialize');
  }
  this._init();

  // Public methods to be exposed on the created object
  return {
    markdown: function(){

    },
    html: function(){

    },
    save: function(){

    }
  };
}

Kramdown.prototype._merge = function(config){
  var cfg = {};
  if (typeof config === 'string') {
    cfg.el = config;
    if (cfg.el.indexOf('.') !== -1) {
      throw new Error('Kramdown takes only element with a valid id as a string parameter');
    }
    var elName = cfg.el.replace(/^(#)/,'');
    cfg.el = document.getElementById(elName);
    config = cfg;
  } else if (typeof config === 'object' || typeof config === 'undefined' || emptyObj(config)) {
    cfg = extendObj({}, config);
    if(document.getElementsByTagName('textarea').length > 0){
      cfg.el = document.getElementsByTagName('textarea')[0];
    }
    config = cfg;
  }

  return config;
};

// TODO: Look for all public methods to
// expose on the button api
// TO BE DONE AT LAST
Kramdown.prototype._buttonApi = function(){
  var self = this;
  var check = function(){
    if(! self.options.toolbar){
      throw new Error('Warning: Please enable toolbar to use the button api');
    }
  };

  return {
    get: function(name){
      check();
      var btn = this._getToolbarItem(name);
      return btn;
    },
    add: function(name, title){
      check();
      title !== undefined ? title : title = name.charAt(0).toUpperCase() + name.slice(1);
      var btn = this._addToolbarItem(name, title);
      return btn;
    },
    remove: function(name){
      check();
      this._removeToolbarItem(name);
    },
    addCallback: function(name, callback){
      check();
      this._addToolbarItemCallback(name, callback);
    },
    addDropdown: function(button, dropdown){
      check();
      this._addToolbarItemDropdown(button, dropdown);
    }
  };
};

Kramdown.prototype._pluginApi = function(plugins){
  if(typeof this.options.plugins !== 'object'){
    throw new Error('Plugins option has to be an object');
  }
  var items = {};
  if(typeof plugins === 'object'){
    for (var i = 0; i < plugins.length; i++){
      var pname = plugins[i];
      if(! KramdownPlugins[pname]){
        return;
      }
      items[pname] = KramdownPlugins[pname];
    }
  }
  return items;
};

Kramdown.prototype._initButtonApi = function(){
  try{
    this.button = {};
    this._bindMethods(this._buttonApi(), this.button);
  } catch (err) {
    console.warn(err.message);
  }
};

Kramdown.prototype._initPluginApi = function(){
  try{
    var plugins = this._pluginApi(this.options.plugins);
    this._bindMethods(plugins, this);
    for (var key in plugins){
      this._bindMethods(plugins[key](), this[key]);
      this[key].init();
    }
  } catch(err) {
   console.warn(err.message);
  }
};

Kramdown.prototype._initApi = function(){
  // Bootstrap modules in order
  this._initButtonApi();
  this._initPluginApi();
};

Kramdown.prototype._init = function(){
  this._render();
  this._initApi();
};

Kramdown.prototype._render = function(){
  var options = this.options, wrapper;

  var el = this.options.el;
  var keyMaps = this._bindShortcuts();

  wrapper = document.createElement('div');
  addClass(wrapper, 'kramdown-box');

  // TODO: Implement a localstorage mechanism to find out
  // whether something is stored in localstorage, and if yes
  // then throw its value into the editor
  this.cm = CodeMirror.fromTextArea(el, {
    mode: 'markdown',
    theme: 'paper',
    indentSize: 2,
    indentWithTabs: true,
    lineNumbers: false,
    lineWrapping: true,
    autofocus: true,
    extraKeys: keyMaps
  });
  addClass(this.cm.getWrapperElement(), 'kramdown-editor');

  wrapper.appendChild(this.cm.getWrapperElement());
  el.parentNode.appendChild(wrapper);

  // Create toolbar after bootstrapping plugins
  if(options.toolbar){
    this._createToolbar(options.buttons);
  }

  // Create statusbar after bootstrapping toolbar
  if(options.statusbar){
    this._createStatusbar(options.status);
  }
};


Kramdown.prototype._bindMethods = function(object, self){
  for (var key in object){
    if(object.hasOwnProperty(key)){
      self[key] = object[key].bind(this);
    }
  }
};

Kramdown.prototype._bindShortcuts = function(){
  var keyMaps = {};
  for (var key in shortcuts) {
    if(shortcuts.hasOwnProperty(key)){
      mapToolbarShortcut(keyMaps, key, this);
    }
  }
  keyMaps['Enter'] = 'newlineAndIndentContinueMarkdownList';

  return keyMaps;
};

Kramdown.prototype._bindToolbarEvent = function(ev, el, listener){
  el.addEventListener(ev, listener, false);
};

Kramdown.prototype._unbindToolbarEvent = function(ev, el, listener){
  el.removeEventListener(ev, listener, false);
};

Kramdown.prototype._getToolbarItem = function(name){
  var item = this._getToolbar().bar;
  return item.querySelector('.kramdown-toolbar-' + name).parentNode;
};

Kramdown.prototype._addToolbarItem = function(name, title){
  var obj = this._getToolbar();
  var elem = this._buildToolbarItem(name, title);
  obj.bar.appendChild(elem.el);
  obj.tip.appendChild(elem.et);

  return elem.el;
};

Kramdown.prototype._removeToolbarItem = function(name){
  var obj = this._getToolbar();
  var el = obj.bar.querySelector('.kramdown-toolbar-' + name);
  var et = obj.tip.querySelector('.kramdown-tooltip-' + name);
  el.removeEventListener('click');
  obj.bar.removeChild(el.parentNode);
  obj.tip.removeChild(et);
};

Kramdown.prototype._addToolbarItemCallback = function(name, callback){
  var btn = this._getToolbarItem(name);
  btn.addEventListener('click', callback);
  return btn;
};

Kramdown.prototype._addToolbarItemDropdown = function(button, dropdown){
  var ul, li, link;
  ul = document.createElement('ul');

  addClass(ul, 'kramdown-toolbar-dropdown');
  addClass(button, 'kramdown-has-dropdown');

  function showDropdown(e){
    var dd = document.querySelector('.kramdown-toolbar-dropdown');
    addClass(dd.parentNode, 'active');
    e.stopPropagation();
    return false;
  }

  function hideDropdown(e){
    var dd = document.querySelector('.kramdown-toolbar-dropdown');
    removeClass(dd.parentNode, 'active');
    e.stopPropagation();
    return false;
  }

  function callback(e){
    e.target.callback.apply();
    hideDropdown(e);
  }

  for (var i = 0; i < dropdown.length; i++){
    li = document.createElement('li');
    link = document.createElement('a');

    link.innerHTML = dropdown[i].name;
    link.callback = dropdown[i].callback;
    addAttr(link, 'href', 'javascript:void(0)');
    addClass(link, 'kramdown-toolbar-' + dropdown[i].title);
    this._bindToolbarEvent('click', link, callback);

    li.appendChild(link);
    ul.appendChild(li);
  }

  this._unbindToolbarEvent('click', button.querySelector('a'), action);
  this._bindToolbarEvent('click', button, showDropdown);
  this._bindToolbarEvent('click', document, hideDropdown);
  button.appendChild(ul);

  return button;
};

Kramdown.prototype._buildTooltipItem = function(button){
  var tt = document.createElement('span');
  addClass(tt, 'kramdown-tooltip-' + button);
  tt.innerHTML = buttonNames[button];

  return tt;
};

Kramdown.prototype._buildToolbarItem = function(name, title){
  var li, tip, link;
  link = document.createElement('a');
  li = document.createElement('li');

  addAttr(link, 'href', 'javascript:void(0)');
  addAttr(link, 'name', name);
  addClass(link, 'kramdown-toolbar-' + name);

  if(!buttonNames.hasOwnProperty(name)){
    buttonNames[name] = title;
  }

  function mover(e){
    var tt = document.querySelector('.kramdown-tooltip-' + name);
    tt.style.display = 'block';
    tt.style.left = position(e.toElement, tt).left;
    return false;
  }

  function mout(){
    var tt = document.querySelector('.kramdown-tooltip-' + name);
    tt.style.display = 'none';
    return false;
  }

  link.context = this;
  link.name = name;
  this._bindToolbarEvent('click', link, action);
  this._bindToolbarEvent('mouseover', link, mover);
  this._bindToolbarEvent('mouseout', link, mout);

  tip = this._buildTooltipItem(name);
  li.appendChild(link);

  return { el: li, et: tip };
};

Kramdown.prototype._createToolbar = function(buttons){
  var toolbar, tooltip, wrapper = this.cm.getWrapperElement();
  toolbar = document.createElement('ul');
  tooltip = document.createElement('div');

  addClass(toolbar, 'kramdown-toolbar');
  addClass(tooltip, 'kramdown-tooltip');

  for (var i = 0; i < buttons.length; i++){
    var items = this._buildToolbarItem(buttons[i], buttonNames[buttons[i]]);
    toolbar.appendChild(items.el);
    tooltip.appendChild(items.et);
  }

  wrapper.parentNode.insertBefore(toolbar, wrapper);
  wrapper.parentNode.insertBefore(tooltip, wrapper);

  return toolbar;
};

Kramdown.prototype._getToolbar = function(){
  var obj = {};
  obj.bar = document.querySelector('.kramdown-toolbar');
  obj.tip = document.querySelector('.kramdown-tooltip');
  return obj;
};

Kramdown.prototype._buildStatusbarItem = function(name){
  var cm = this.cm, el;
  el = document.createElement('span');
  addClass(el, name);
  el.innerHTML = '0';
  switch(name) {
    case 'lines':
      this.cm.on('update', function() {
        if(cm.getValue() !== '') {
          el.innerHTML = cm.lineCount();
        } else {
          el.innerHTML = '0';
        }
      });
      break;
    case 'words':
      this.cm.on('update', function(){
        if(cm.getValue() !== ''){
          el.innerHTML = cm.getValue().split('\n').join(' ').split(' ').length;
        } else {
          el.innerHTML = '0';
        }
      });
      break;
    case 'chars':
      this.cm.on('update', function() {
        el.innerHTML = cm.getValue().length;
      });
      break;
    case 'cursor':
      el.innerHTML = '0:0';
      this.cm.on('cursorActivity', function() {
        var pos = cm.getCursor();
        el.innerHTML = pos.line + ':' + pos.ch;
      });
      break;
    default:
      break;
  }
  return el;
};

Kramdown.prototype._createStatusbar = function(status){
  var statusbar, wrapper = this.cm.getWrapperElement();
  statusbar = document.createElement('div');
  addClass(statusbar, 'kramdown-statusbar');

  var stats = document.createElement('span');
  addClass(stats, 'stats');

  statusbar.appendChild(stats);

  for (var i = 0; i < status.length; i++) {
    statusbar.appendChild(this._buildStatusbarItem(status[i]));
  }

  wrapper.parentNode.insertBefore(statusbar, wrapper.nextSibling);
  return statusbar;
};

// TODO: Perform all basic actions
// else break it from here
// If new button added via api, then
// can include it as a plugin
Kramdown.prototype._action = function(name){
  var cm = this.cm, action;
  if(cm.getSelection() !== ''){
    action = replaceAction;
  } else {
    action = toggleAction;
  }

  switch(name){
    case 'bold':
      this._exec(action, cm, name, '**');
      break;
    case 'italic':
      this._exec(action, cm, name, '*');
      break;
    case 'strike':
      this._exec(action, cm, name, '~~');
      break;
    case 'heading':
      this._exec(action, cm, name, '## ', null);
      break;
    case 'quote':
      this._exec(action, cm, name, '> ', null);
      break;
    case 'ul':
      this._exec(action, cm, name, '- ', null);
      break;
    case 'ol':
      this._exec(action, cm, name, '1. ', null);
      break;
    case 'indent':
      this._exec(action, cm, name, null, null);
      break;
    case 'outdent':
      this._exec(action, cm, name, null, null);
      break;
    case 'link':
      this._exec(action, cm, name, '[', '](http://)');
      break;
    case 'image':
      this._exec(action, cm, name, '![', '](http://)');
      break;
    case 'video':
      this._exec(action, cm, name, '<iframe src="', '"></iframe>');
      break;
    default:
      break;
  }
};

Kramdown.prototype._exec = function(action){
  action.call(this, arguments);
};