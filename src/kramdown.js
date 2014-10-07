var hasClass = function(elem, className) {
  return new RegExp(' ' + className + ' ').test(' ' + elem.className + ' ');
};

var addClass = function(elem, className) {
  if(elem.className === ''){
    elem.className = className;
  } else if (!hasClass(elem, className)) {
    elem.className += ' ' + className;
  }
};

var removeClass = function(elem, className) {
  var newClass = ' ' + elem.className.replace(/[\t\r\n]/g, ' ') + ' ';
  if (hasClass(elem, className)) {
    while (newClass.indexOf(' ' + className + ' ') >= 0) {
      newClass = newClass.replace(' ' + className + ' ', ' ');
    }
    elem.className = newClass.replace(/^\s+|\s+$/g, '');
  }
};

var addAttr = function(elem, name, attr){
  elem.setAttribute(name, attr);
};

var removeAttr = function(elem, name){
  elem.removeAttribute(name);
};


var offset = function(elem){
  var off = {};
  off.left = elem.offsetLeft;
  off.top = elem.offsetTop;

  return off;
};

var innerHeight = function(elem){
  return elem.offsetHeight;
};

var innerWidth = function(elem){
  return elem.offsetWidth;
};

var position = function(parent, child){
  var pos = {};
  pos.left = (offset(parent).left - (innerWidth(child) - innerWidth(parent))/2) + 'px';
  pos.top = (offset(parent).top - (innerHeight(child) - innerHeight(parent))/2) + 'px';

  return pos;
};

var extendObj = function(){
  for(var i=1; i<arguments.length; i++){
    for(var key in arguments[i]){
      if(arguments[i].hasOwnProperty(key))
      {
        arguments[0][key] = arguments[i][key];
      }
    }
  }
  return arguments[0];
};

var emptyObj = function(o){
  for(var prop in o){
    if(o.hasOwnProperty(prop)){
      return false;
    }
  }
  return true;
};

// TODO: Implement strike functionality in
// markdown and include it with the markdown library,
// so that include only codemirror and cml libraries

var getState = function(cm){
  var pos;
  pos = pos || cm.getCursor('from');
  var stat = cm.getTokenAt(pos);

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
};

var getParams = function(args){
  var obj = {};
  obj.cm = args[1];
  obj.name = args[2];
  obj.state = getState(args[1]);
  obj.instate = obj.state[obj.name];
  obj.start = args[3];
  obj.end = args[4];
  obj.startPoint = args[1].getCursor('from');
  obj.endPoint = args[1].getCursor('to');

  return obj;
};


var replaceSelection = function(args){
  var params = getParams(args);
  var cm = params.cm;
  var start = params.startPoint, end = params.endPoint;
  var selection, nstart = {}, nend = {}, nsel = {}, esel = {};

  selection = cm.getSelection();
  nstart.line = nend.line = start.line;
  nsel.line = esel.line = start.line;
  params.end === null ? params.end = '' : params.end = params.end || params.start;

  var text = cm.getLine(start.line);
  var stext = text.slice(0, start.ch);
  var etext = text.slice(start.ch);
  var slen = stext.length;

  switch (params.name) {
    case 'bold':
      stext = stext.replace(/^(.*)?(\*|_){2}(\S+.*)?$/, '$1$3');
      etext = etext.replace(/^(.*\S+)(\*|_){2}(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, nsel.ch = start.ch - 2) : nstart.ch = start.ch + 2;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 2) : nend.ch = end.ch + 2;
      break;
    case 'italic':
      stext = stext.replace(/^(.*)?(\*|_)(\S+.*)?$/, '$1$3');
      etext = etext.replace(/^(.*\S+)?(\*|_)(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, nsel.ch = start.ch - 1) : nstart.ch = start.ch + 1;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 1) : nend.ch = end.ch + 1;
      break;
    case 'heading':
      selection = text;
      stext = stext.replace(/^(.*)?(#\s?){2}(\S+.*)?/, '$1$3');
      etext = etext.replace(/^(.*\S+)?(\s?#){2}(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, nsel.ch = start.ch + stext.length - slen) : (nstart.ch = 0, nsel.ch = start.ch + 3);
      params.instate ? (nend.ch = text.length, esel.ch = end.ch + stext.length - slen) : (nend.ch = text.length, esel.ch = end.ch + 3);
      break;
    case 'quote':
      selection = text;
      stext = stext.replace(/^(.*)?(>\s?)(\S+.*)?/, '$1$3');
      etext = etext.replace(/^(.*\S+)?(\s?)(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, nsel.ch = start.ch + stext.length - slen) : (nstart.ch = 0, nsel.ch = start.ch + 2);
      params.instate ? (nend.ch = text.length, esel.ch = end.ch + stext.length - slen): (nend.ch = text.length, esel.ch = end.ch + 2);
      break;
    case 'link':
      stext = stext.replace(/(.*)?(\[)(\S+.*)?/, '$1');
      etext = etext.replace(/(]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\))(\s+.*)?/, '$2');
      params.instate ? (nstart.ch = 0, nsel.ch = start.ch - 1) : nstart.ch = start.ch + 1;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 1) : nend.ch = end.ch + 1;
      break;
    case 'image':
      stext = stext.replace(/(.*)?(!\[)(\S+.*)?/, '$1');
      etext = etext.replace(/(]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\))(\s+.*)?/, '$2');
      params.instate ? (nstart.ch = 0, nsel.ch = start.ch - 2) : nstart.ch = start.ch + 2;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 2) : nend.ch = end.ch + 2;
      break;
    default:
      break;
  }

  if(params.instate){
    cm.replaceRange(stext + etext, nstart, nend);
    cm.setSelection(nsel, esel);
  } else {
    if(params.name === 'heading' || params.name === 'quote'){
      cm.replaceRange(params.start + selection + params.end, nstart, nend);
      cm.setSelection(nsel, esel);
    } else {
      cm.replaceSelection(params.start + selection + params.end, 'around');
      cm.setSelection(nstart, nend);
    }
  }

  cm.focus();
  return;
};

// TODO: If not in state, return, else do the
// toggling stuff if there is no selection

var toggleSelection = function(args){
  var params = getParams(args);
  switch(params.name){
    case 'bold':
      params.instate ? console.log('Toggling bold') : console.log('Inserting bold');
      break;
    case 'italic':
      params.instate ? console.log('Toggling italic') : console.log('Inserting italic');
      break;
    case 'heading':
      params.instate ? console.log('Toggling heading') : console.log('Inserting heading');
      break;
    default:
      break;
  }
};

var isMac =  /Mac/.test(navigator.platform);

var shortcuts = {
  bold: 'Cmd-B',
  italic: 'Cmd-I',
  strike: 'Alt-S',
  heading: 'Alt-H',
  quote: 'Cmd-\'',
  ul: 'Alt-U',
  ol: 'Alt-O',
  code: 'Cmd-\/',
  link: 'Cmd-Alt-L',
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
  code: 'Code',
  link: 'Link',
  image: 'Image',
  video: 'Video'
};

var defaults = {
  el: '',
  toolbar: true,
  statusbar: true,
  buttons: ['bold', 'italic', 'strike', 'heading', 'quote', 'ul', 'ol', 'code', 'link', 'image', 'video'],
  status: ['lines', 'words', 'chars', 'cursor'],
  shortcutBtns: shortcuts,
  plugins: false

  // functionality to add external functionality as adding modals
  // dialogs, overlays, etc, include in the library only.
  // make no dependencies other than codemirror and marked
};

var fixToolbarShortcut = function(text){
  if (isMac) {
    text = text.replace('Ctrl', 'Cmd');
  } else {
    text = text.replace('Cmd', 'Ctrl');
  }
  return text;
};

var mapToolbarShortcut = function(keyMaps, key, kd){
  keyMaps[fixToolbarShortcut(shortcuts[key])] = function () {
    kd._action(key);
  };
};

// Kramdown constructor
var Kramdown = function(config){
  var cfg, options;
  cfg = this._merge(config);
  options = this.options = extendObj({}, defaults, cfg);
  if(!options.el){
    throw new Error('Kramdown requires atleast one textarea element to initialize');
  }
  this._init();
};

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
      if(!title){
        title = name.charAt(0).toUpperCase() + name.slice(1);
      }

      var btn = this._addToolbarItem(name, title);
      return btn;
    },
    remove: function(name){
      check();
      this._removeToolbarItem(name);
    },
    addCallback: function(name, callback){
      check();
      var btn = this._getToolbarItem(name);
      btn.addEventListener('click', callback);
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
    this._bindMethods(this._buttonApi(this.options.buttons), this.button);
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
  // Bind all the common events
  this._bindEvents();

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

  this.cm = CodeMirror.fromTextArea(el, {
    mode: 'markdown',
    theme: 'paper',
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

Kramdown.prototype._bindScrollEvent = function(){
  if(!this.options.toolbar){
    return;
  }
  var cm = this.cm;
  var self = this;
  cm.on('scroll', function(){
    var cmScroll = cm.getWrapperElement().querySelector('.CodeMirror-scroll');
    if(cmScroll.scrollTop > 0){
      addClass(self.toolbar, 'kramdown-shadow');
    } else {
      removeClass(self.toolbar, 'kramdown-shadow');
    }
  });
};

Kramdown.prototype._bindEvents = function(){
  this._bindScrollEvent();
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

  // Bind the shortcuts here
  keyMaps['Enter'] = 'newlineAndIndentContinueMarkdownList';

  // Implement these two functions in commands file
  //keyMaps['Tab'] = 'tabAndIndentContinueMarkdownList';
  //keyMaps['Shift-Tab'] = 'shiftTabAndIndentContinueMarkdownList';

  return keyMaps;
};

Kramdown.prototype._getToolbarItem = function(name){
  var item = this._getToolbar().bar;
  return item.querySelector('.kramdown-toolbar-' + name);
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

Kramdown.prototype._bindToolbarEvent = function(ev, el, callback){
  el.addEventListener(ev, callback);
};

Kramdown.prototype._buildTooltipItem = function(button){
  var tt = document.createElement('span');
  addClass(tt, 'kramdown-tooltip-' + button);
  tt.innerHTML = buttonNames[button];

  return tt;
};

Kramdown.prototype._buildToolbarItem = function(name, title){
  var li, tip, link, mover, mout;
  link = document.createElement('a');
  li = document.createElement('li');

  addAttr(link, 'href', 'javascript:void(0)');
  addClass(link, 'kramdown-toolbar-' + name);

  mover = function(e){
    var tt = document.querySelector('.kramdown-tooltip-' + name);
    tt.style.display = 'block';
    tt.style.left = position(e.toElement, tt).left;
    return false;
  };

  mout = function(){
    var tt = document.querySelector('.kramdown-tooltip-' + name);
    tt.style.display = 'none';
    return false;
  };

  if(!buttonNames.hasOwnProperty(name)){
    buttonNames[name] = title;
  }

  var self = this;
  link.addEventListener('click', function(){
    self._action(name);
    return false;
  });

  this._bindToolbarEvent('mouseover', li, mover);
  this._bindToolbarEvent('mouseout', li, mout);

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
  addClass(stats, 'kd-stats');

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
    action = replaceSelection;
  } else {
    action = toggleSelection;
  }

  switch(name){
    case 'bold':
      this._exec(action, cm, name, '**');
      break;
    case 'italic':
      this._exec(action, cm, name, '*');
      break;
    case 'heading':
      this._exec(action, cm, name, '## ', null);
      break;
    case 'quote':
      this._exec(action, cm, name, '> ', null);
      break;
    case 'link':
      this._exec(action, cm, name, '[', '](http://)');
      break;
    case 'image':
      this._exec(action, cm, name, '![', '](http://)');
      break;
    default:
      break;
  }

};

Kramdown.prototype._exec = function(action){
  action.call(this, arguments);
};