function extendObj(a, b){
  for(var key in b) {
    if (b.hasOwnProperty(key)) {
      a[key] = b[key];
    }
  }
  return a;
}

function emptyObj(o){
  for(var prop in o){
    if(o.hasOwnProperty(prop)){
      return false;
    }
  }
  return true;
}

var isMac =  /Mac/.test(navigator.platform);

var shortcuts = {
  bold: 'Cmd-B',
  italic: 'Cmd-I',
  strike: 'Cmd-Alt-S',
  quote: 'Cmd-\'',
  ul: 'Cmd-Alt-U',
  ol: 'Cmd-Alt-O',
  code: 'Cmd-\/',
  link: 'Cmd-Alt-L',
  image: 'Cmd-Alt-I',
  video: 'Cmd-Alt-V'
};

var defaults = {
  el: '',
  toolbar: true,
  statusbar: true,
  toolbarBtns: ['bold', 'italic', 'strike', 'quote', 'ul', 'ol', 'code', 'link', 'image', 'video'],

  // Based on statusbar value, just loop over the
  // below elements and setup the statusbar
  //statusbarBtns: ['words', 'chars', 'lines'],

  shortcutBtns: shortcuts,
  plugins: false

  // functionality to add external functionality as adding modals
  // dialogs, overlays, etc, include in the library only.
  // make no dependencies other than codemirror and marked

  // functionality to add buttons via an api
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

var Kramdown = function(config){
  var options;
  options = this.options = extendObj(defaults, this._merge(config));
  if(!options.el){
    throw new Error('Kramdown requires atleast one textarea element to initialize');
  }
  // Stop here for today
  // continue tonight
  //this.button = {
  //  add: function(button){
  //    options.toolbarBtns.push(button);
  //  }
  //};
  this._init(options);
};

Kramdown.prototype.button = function(){};

Kramdown.prototype.button.add = function(button){
  console.log(button);
};


Kramdown.prototype._merge = function(config){
  var cfg = extendObj({}, config);
  if (typeof config === 'string') {
    cfg.el = config;
    if (cfg.el.indexOf('.') !== -1) {
      throw new Error('Kramdown takes only element with a valid id as a string parameter');
    }
    var elName = cfg.el.replace(/^(#)/,'');
    cfg.el = document.getElementById(elName);
    config = cfg;
  } else if (typeof config === 'object' || typeof config === 'undefined' || emptyObj(config)) {
    if(document.getElementsByTagName('textarea').length > 0){
      cfg.el = document.getElementsByTagName('textarea')[0];
    }
    config = cfg;
  }

  return config;
};


Kramdown.prototype._init = function(){
  this._render();
};

Kramdown.prototype._render = function(){
  var options = this.options;
  var el = options.el;
  var keyMaps = {};

  this._createShortcuts(keyMaps);

  this.cm = CodeMirror.fromTextArea(el, {
    mode: 'markdown',
    theme: 'paper',
    indentWithTabs: true,
    lineNumbers: false,
    autofocus: true,
    extraKeys: keyMaps
  });

  this.cm.getWrapperElement().className = this.cm.getWrapperElement().className + ' kramdown-wrapper';

  if(options.plugins){
    this._bindPlugins();
  }

  // Create toolbar after bootstrapping plugins
  if(options.toolbar){
    this._createToolbar(options.toolbarBtns);
  }

  if(options.statusbar){
    console.log('Creating statusbar...');
  }
};

Kramdown.prototype._bindPlugins = function(){
  var pname;
  var plugins = this.options.plugins;
  if(typeof plugins === 'object'){
    for (var i = 0; i < plugins.length; i++){
      pname = plugins[i];
      if(! KramdownPlugins[pname]){
        return;
      }
      this[pname] = KramdownPlugins[pname]();
      this._bindPluginMethods(this[pname], this);
      this.init();
    }
  }
};

Kramdown.prototype._bindPluginMethods = function(method, self){
  for (var key in method){
    if(method.hasOwnProperty(key)){
      self[key] = method[key].bind(this);
    }
  }
};

Kramdown.prototype._createShortcuts = function(keyMaps){
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

};

Kramdown.prototype._createToolbar = function(buttons){
  var toolbar;
  toolbar = document.createElement('div');
  toolbar.className = 'kramdown-toolbar';

  for(var i=0; i < buttons.length; i++){
    console.log(buttons[i]);
  }
};

Kramdown.prototype._action = function(name){
  if(this.cm.getSelection() !== ''){
    console.log('Replacing ' + name);
    console.log(this.cm.listSelections());
    return;
  }
  console.log('Toggling ' + name);
};