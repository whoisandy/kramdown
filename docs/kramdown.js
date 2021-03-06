(function(global){

'use strict;'

CodeMirror.defineMode('markdown', function(cmCfg, modeCfg) {

  var htmlFound = CodeMirror.modes.hasOwnProperty('xml');
  var htmlMode = CodeMirror.getMode(cmCfg, htmlFound ? {name: 'xml', htmlMode: true} : 'text/plain');
  var aliases = {
    html: 'htmlmixed',
    js: 'javascript',
    json: 'application/json',
    c: 'text/x-csrc',
    'c++': 'text/x-c++src',
    java: 'text/x-java',
    csharp: 'text/x-csharp',
    'c#': 'text/x-csharp',
    scala: 'text/x-scala'
  };

  var getMode = (function () {
    var i, modes = {}, mimes = {}, mime;

    var list = [];
    for (var m in CodeMirror.modes)
      if (CodeMirror.modes.propertyIsEnumerable(m)) list.push(m);
    for (i = 0; i < list.length; i++) {
      modes[list[i]] = list[i];
    }
    var mimesList = [];
    for (var m in CodeMirror.mimeModes)
      if (CodeMirror.mimeModes.propertyIsEnumerable(m))
        mimesList.push({mime: m, mode: CodeMirror.mimeModes[m]});
    for (i = 0; i < mimesList.length; i++) {
      mime = mimesList[i].mime;
      mimes[mime] = mimesList[i].mime;
    }

    for (var a in aliases) {
      if (aliases[a] in modes || aliases[a] in mimes)
        modes[a] = aliases[a];
    }

    return function (lang) {
      return modes[lang] ? CodeMirror.getMode(cmCfg, modes[lang]) : null;
    };
  }());

  // Should characters that affect highlighting be highlighted separate?
  // Does not include characters that will be output (such as `1.` and `-` for lists)
  if (modeCfg.highlightFormatting === undefined)
    modeCfg.highlightFormatting = false;

  // Maximum number of nested blockquotes. Set to 0 for infinite nesting.
  // Excess `>` will emit `error` token.
  if (modeCfg.maxBlockquoteDepth === undefined)
    modeCfg.maxBlockquoteDepth = 0;

  // Should underscores in words open/close em/strong?
  if (modeCfg.underscoresBreakWords === undefined)
    modeCfg.underscoresBreakWords = true;

  // Turn on fenced code blocks? ('```' to start/end)
  if (modeCfg.fencedCodeBlocks === undefined) modeCfg.fencedCodeBlocks = false;

  // Turn on task lists? ('- [ ] ' and '- [x] ')
  if (modeCfg.taskLists === undefined) modeCfg.taskLists = false;

  var codeDepth = 0;

  var header   = 'header'
    ,   code     = 'comment'
    ,   quote    = 'quote'
    ,   list1    = 'variable-2'
    ,   list2    = 'variable-3'
    ,   list3    = 'keyword'
    ,   hr       = 'hr'
    ,   image    = 'tag'
    ,   formatting = 'formatting'
    ,   linkinline = 'link'
    ,   linkemail = 'link'
    ,   linktext = 'link'
    ,   linkhref = 'string'
    ,   em       = 'em'
    ,   strong   = 'strong',
        strike   = 'strike';

  var hrRE = /^([*\-=_])(?:\s*\1){4,}\s*$/
    ,   ulRE = /^[*\-+]\s+/
    ,   olRE = /^[0-9]+\.\s+/
    ,   taskListRE = /^\[(x| )](?=\s)/ // Must follow ulRE or olRE
    ,   atxHeaderRE = /^#+/
    ,   setextHeaderRE = /^(?:=+|-+)$/
    ,   textRE = /^[^#!\[\]*_~\\<>` ''(]+/;

  function switchInline(stream, state, f) {
    state.f = state.inline = f;
    return f(stream, state);
  }

  function switchBlock(stream, state, f) {
    state.f = state.block = f;
    return f(stream, state);
  }


  // Blocks

  function blankLine(state) {
    // Reset linkTitle state
    state.linkTitle = false;
    // Reset EM state
    state.em = false;
    // Reset STRONG state
    state.strong = false;

    //Reset STRIKE state
    state.strike = false;

    // Reset state.quote
    state.quote = 0;
    if (!htmlFound && state.f === htmlBlock) {
      state.f = inlineNormal;
      state.block = blockNormal;
    }
    // Reset state.trailingSpace
    state.trailingSpace = 0;
    state.trailingSpaceNewLine = false;
    // Mark this line as blank
    state.thisLineHasContent = false;
    return null;
  }

  function blockNormal(stream, state) {

    var sol = stream.sol();

    var prevLineIsList = (state.list !== false);
    if (state.list !== false && state.indentationDiff >= 0) { // Continued list
      if (state.indentationDiff < 4) { // Only adjust indentation if *not* a code block
        state.indentation -= state.indentationDiff;
      }
      state.list = null;
    } else if (state.list !== false && state.indentation > 0) {
      state.list = null;
      state.listDepth = Math.floor(state.indentation / 4);
    } else if (state.list !== false) { // No longer a list
      state.list = false;
      state.listDepth = 0;
    }

    var match = null;
    if (state.indentationDiff >= 4) {
      state.indentation -= 4;
      stream.skipToEnd();
      return code;
    } else if (stream.eatSpace()) {
      return null;
    } else if (match = stream.match(atxHeaderRE) || false) {
      state.header = match[0].length <= 6 ? match[0].length : 6;
      if (modeCfg.highlightFormatting) state.formatting = 'header';
      state.f = state.inline;
      return getType(state);
    } else if (state.prevLineHasContent && (match = stream.match(setextHeaderRE))) {
      state.header = match[0].charAt(0) === '=' ? 1 : 2;
      if (modeCfg.highlightFormatting) state.formatting = 'header';
      state.f = state.inline;
      return getType(state);
    } else if (stream.eat('>')) {
      state.indentation++;
      state.quote = sol ? 1 : state.quote + 1;
      if (modeCfg.highlightFormatting) state.formatting = 'quote';
      stream.eatSpace();
      return getType(state);
    } else if (stream.peek() === '[') {
      return switchInline(stream, state, footnoteLink);
    } else if (stream.match(hrRE, true)) {
      return hr;
    } else if ((!state.prevLineHasContent || prevLineIsList) && (stream.match(ulRE, false) || stream.match(olRE, false))) {
      var listType = null;
      if (stream.match(ulRE, true)) {
        listType = 'ul';
      } else {
        stream.match(olRE, true);
        listType = 'ol';
      }
      state.indentation += 4;
      state.list = true;
      state.listDepth++;
      if (modeCfg.taskLists && stream.match(taskListRE, false)) {
        state.taskList = true;
      }
      state.f = state.inline;
      if (modeCfg.highlightFormatting) state.formatting = ['list', 'list-' + listType];
      return getType(state);
    } else if (modeCfg.fencedCodeBlocks && stream.match(/^```([\w+#]*)/, true)) {
      // try switching mode
      state.localMode = getMode(RegExp.$1);
      if (state.localMode) state.localState = state.localMode.startState();
      switchBlock(stream, state, local);
      if (modeCfg.highlightFormatting) state.formatting = 'code-block';
      state.code = true;
      return getType(state);
    }

    return switchInline(stream, state, state.inline);
  }

  function htmlBlock(stream, state) {
    var style = htmlMode.token(stream, state.htmlState);
    if ((htmlFound && state.htmlState.tagStart === null && !state.htmlState.context) ||
      (state.mdInside && stream.current().indexOf('>') > -1)) {
      state.f = inlineNormal;
      state.block = blockNormal;
      state.htmlState = null;
    }
    return style;
  }

  function local(stream, state) {
    if (stream.sol() && stream.match(/^```/, true)) {
      state.localMode = state.localState = null;
      state.f = inlineNormal;
      state.block = blockNormal;
      if (modeCfg.highlightFormatting) state.formatting = 'code-block';
      state.code = true;
      var returnType = getType(state);
      state.code = false;
      return returnType;
    } else if (state.localMode) {
      return state.localMode.token(stream, state.localState);
    } else {
      stream.skipToEnd();
      return code;
    }
  }

  // Inline
  function getType(state) {
    var styles = [];

    if (state.formatting) {
      styles.push(formatting);

      if (typeof state.formatting === 'string') state.formatting = [state.formatting];

      for (var i = 0; i < state.formatting.length; i++) {
        styles.push(formatting + '-' + state.formatting[i]);

        if (state.formatting[i] === 'header') {
          styles.push(formatting + '-' + state.formatting[i] + '-' + state.header);
        }

        // Add `formatting-quote` and `formatting-quote-#` for blockquotes
        // Add `error` instead if the maximum blockquote nesting depth is passed
        if (state.formatting[i] === 'quote') {
          if (!modeCfg.maxBlockquoteDepth || modeCfg.maxBlockquoteDepth >= state.quote) {
            styles.push(formatting + '-' + state.formatting[i] + '-' + state.quote);
          } else {
            styles.push('error');
          }
        }
      }
    }

    if (state.taskOpen) {
      styles.push('meta');
      return styles.length ? styles.join(' ') : null;
    }
    if (state.taskClosed) {
      styles.push('property');
      return styles.length ? styles.join(' ') : null;
    }

    if (state.linkHref) {
      styles.push(linkhref);
      return styles.length ? styles.join(' ') : null;
    }

    if (state.strong) { styles.push(strong); }
    if (state.strike) {styles.push(strike); }
    if (state.em) { styles.push(em); }

    if (state.linkText) { styles.push(linktext); }

    if (state.code) { styles.push(code); }

    if (state.header) { styles.push(header); styles.push(header + '-' + state.header); }

    if (state.quote) {
      styles.push(quote);

      // Add `quote-#` where the maximum for `#` is modeCfg.maxBlockquoteDepth
      if (!modeCfg.maxBlockquoteDepth || modeCfg.maxBlockquoteDepth >= state.quote) {
        styles.push(quote + '-' + state.quote);
      } else {
        styles.push(quote + '-' + modeCfg.maxBlockquoteDepth);
      }
    }

    if (state.list !== false) {
      var listMod = (state.listDepth - 1) % 3;
      if (!listMod) {
        styles.push(list1);
      } else if (listMod === 1) {
        styles.push(list2);
      } else {
        styles.push(list3);
      }
    }

    if (state.trailingSpaceNewLine) {
      styles.push('trailing-space-new-line');
    } else if (state.trailingSpace) {
      styles.push('trailing-space-' + (state.trailingSpace % 2 ? 'a' : 'b'));
    }

    return styles.length ? styles.join(' ') : null;
  }

  function handleText(stream, state) {
    if (stream.match(textRE, true)) {
      return getType(state);
    }
    return undefined;
  }

  function inlineNormal(stream, state) {
    var style = state.text(stream, state);
    if (typeof style !== 'undefined')
      return style;

    if (state.list) { // List marker (*, +, -, 1., etc)
      state.list = null;
      return getType(state);
    }

    if (state.taskList) {
      var taskOpen = stream.match(taskListRE, true)[1] !== 'x';
      if (taskOpen) state.taskOpen = true;
      else state.taskClosed = true;
      if (modeCfg.highlightFormatting) state.formatting = 'task';
      state.taskList = false;
      return getType(state);
    }

    state.taskOpen = false;
    state.taskClosed = false;

    if (state.header && stream.match(/^#+$/, true)) {
      if (modeCfg.highlightFormatting) state.formatting = 'header';
      return getType(state);
    }

    // Get sol() value now, before character is consumed
    var sol = stream.sol();

    var ch = stream.next();

    if (ch === '\\') {
      stream.next();
      if (modeCfg.highlightFormatting) {
        var type = getType(state);
        return type ? type + ' formatting-escape' : 'formatting-escape';
      }
    }

    // Matches link titles present on next line
    if (state.linkTitle) {
      state.linkTitle = false;
      var matchCh = ch;
      if (ch === '(') {
        matchCh = ')';
      }
      matchCh = (matchCh+'').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
      var regex = '^\\s*(?:[^' + matchCh + '\\\\]+|\\\\\\\\|\\\\.)' + matchCh;
      if (stream.match(new RegExp(regex), true)) {
        return linkhref;
      }
    }

    // If this block is changed, it may need to be updated in GFM mode
    if (ch === '`') {
      var previousFormatting = state.formatting;
      if (modeCfg.highlightFormatting) state.formatting = 'code';
      var t = getType(state);
      var before = stream.pos;
      stream.eatWhile('`');
      var difference = 1 + stream.pos - before;
      if (!state.code) {
        codeDepth = difference;
        state.code = true;
        return getType(state);
      } else {
        if (difference === codeDepth) { // Must be exact
          state.code = false;
          return t;
        }
        state.formatting = previousFormatting;
        return getType(state);
      }
    } else if (state.code) {
      return getType(state);
    }

    if (ch === '!' && stream.match(/\[[^\]]*] ?(?:\(|\[)/, false)) {
      stream.match(/\[[^\]]*]/);
      state.inline = state.f = linkHref;
      return image;
    }

    if (ch === '[' && stream.match(/.*](\(| ?\[)/, false)) {
      state.linkText = true;
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      return getType(state);
    }

    if (ch === ']' && state.linkText) {
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      var type = getType(state);
      state.linkText = false;
      state.inline = state.f = linkHref;
      return type;
    }

    if (ch === '<' && stream.match(/^(https?|ftps?):\/\/(?:[^\\>]|\\.)+>/, false)) {
      state.f = state.inline = linkInline;
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      var type = getType(state);
      if (type){
        type += ' ';
      } else {
        type = '';
      }
      return type + linkinline;
    }

    if (ch === '<' && stream.match(/^[^> \\]+@(?:[^\\>]|\\.)+>/, false)) {
      state.f = state.inline = linkInline;
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      var type = getType(state);
      if (type){
        type += ' ';
      } else {
        type = '';
      }
      return type + linkemail;
    }

    if (ch === '<' && stream.match(/^\w/, false)) {
      if (stream.string.indexOf('>') !== -1) {
        var atts = stream.string.substring(1,stream.string.indexOf('>'));
        if (/markdown\s*=\s*('|')?1('|')?/.test(atts)) {
          state.mdInside = true;
        }
      }
      stream.backUp(1);
      state.htmlState = CodeMirror.startState(htmlMode);
      return switchBlock(stream, state, htmlBlock);
    }

    if (ch === '<' && stream.match(/^\/\w*?>/)) {
      state.mdInside = false;
      return 'tag';
    }

    var ignoreUnderscore = false;
    if (!modeCfg.underscoresBreakWords) {
      if (ch === '_' && stream.peek() !== '_' && stream.match(/(\w)/, false)) {
        var prevPos = stream.pos - 2;
        if (prevPos >= 0) {
          var prevCh = stream.string.charAt(prevPos);
          if (prevCh !== '_' && prevCh.match(/(\w)/, false)) {
            ignoreUnderscore = true;
          }
        }
      }
    }
    if (ch === '*' || (ch === '_' && !ignoreUnderscore)) {
      if (sol && stream.peek() === ' ') {
        // Do nothing, surrounded by newline and space
      } else if (state.strong === ch && stream.eat(ch) && stream.peek(ch)) { // Remove STRONG
        if (modeCfg.highlightFormatting) state.formatting = 'strong';
        var t = getType(state);
        state.strong = false;
        return t;
      } else if (!state.strong && stream.eat(ch) && stream.peek(ch)) { // Add STRONG
        state.strong = ch;
        if (modeCfg.highlightFormatting) state.formatting = 'strong';
        return getType(state);
      } else if (state.em === ch) { // Remove EM
        if (modeCfg.highlightFormatting) state.formatting = 'em';
        var t = getType(state);
        state.em = false;
        return t;
      } else if (!state.em) { // Add EM
        state.em = ch;
        if (modeCfg.highlightFormatting) state.formatting = 'em';
        return getType(state);
      }
    } else if (ch === '~') {
      if (state.strike === ch) { // Remove SRTIKE
        if (modeCfg.highlightFormatting) state.formatting = 'strike';
        var t = getType(state);
        state.strike = false;
        return t;
      } else if (!state.strike) { // Add STRIKE
        state.strike = ch;
        if (modeCfg.highlightFormatting) state.formatting = 'strike';
        return getType(state);
      }
    } else if (ch === ' ') {
      if (stream.eat('*') || stream.eat('_')) { // Probably surrounded by spaces
        if (stream.peek() === ' ') { // Surrounded by spaces, ignore
          return getType(state);
        } else { // Not surrounded by spaces, back up pointer
          stream.backUp(1);
        }
      }
    }

    if (ch === ' ') {
      if (stream.match(/ +$/, false)) {
        state.trailingSpace++;
      } else if (state.trailingSpace) {
        state.trailingSpaceNewLine = true;
      }
    }

    return getType(state);
  }

  function linkInline(stream, state) {
    var ch = stream.next();

    if (ch === '>') {
      state.f = state.inline = inlineNormal;
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      var type = getType(state);
      if (type){
        type += ' ';
      } else {
        type = '';
      }
      return type + linkinline;
    }

    stream.match(/^[^>]+/, true);

    return linkinline;
  }

  function linkHref(stream, state) {
    // Check if space, and return NULL if so (to avoid marking the space)
    if(stream.eatSpace()){
      return null;
    }
    var ch = stream.next();
    if (ch === '(' || ch === '[') {
      state.f = state.inline = getLinkHrefInside(ch === '(' ? ')' : ']');
      if (modeCfg.highlightFormatting) state.formatting = 'link-string';
      state.linkHref = true;
      return getType(state);
    }
    return 'error';
  }

  function getLinkHrefInside(endChar) {
    return function(stream, state) {
      var ch = stream.next();

      if (ch === endChar) {
        state.f = state.inline = inlineNormal;
        if (modeCfg.highlightFormatting) state.formatting = 'link-string';
        var returnState = getType(state);
        state.linkHref = false;
        return returnState;
      }

      if (stream.match(inlineRE(endChar), true)) {
        stream.backUp(1);
      }

      state.linkHref = true;
      return getType(state);
    };
  }

  function footnoteLink(stream, state) {
    if (stream.match(/^[^\]]*]:/, false)) {
      state.f = footnoteLinkInside;
      stream.next(); // Consume [
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      state.linkText = true;
      return getType(state);
    }
    return switchInline(stream, state, inlineNormal);
  }

  function footnoteLinkInside(stream, state) {
    if (stream.match(/^]:/, true)) {
      state.f = state.inline = footnoteUrl;
      if (modeCfg.highlightFormatting) state.formatting = 'link';
      var returnType = getType(state);
      state.linkText = false;
      return returnType;
    }

    stream.match(/^[^\]]+/, true);

    return linktext;
  }

  function footnoteUrl(stream, state) {
    // Check if space, and return NULL if so (to avoid marking the space)
    if(stream.eatSpace()){
      return null;
    }
    // Match URL
    stream.match(/^[^\s]+/, true);
    // Check for link title
    if (stream.peek() === undefined) { // End of line, set flag to check next line
      state.linkTitle = true;
    } else { // More content on line, check if link title
      stream.match(/^(?:\s+(?:'(?:[^'\\]|\\\\|\\.)+'|'(?:[^'\\]|\\\\|\\.)+'|\((?:[^)\\]|\\\\|\\.)+\)))?/, true);
    }
    state.f = state.inline = inlineNormal;
    return linkhref;
  }

  var savedInlineRE = [];
  function inlineRE(endChar) {
    if (!savedInlineRE[endChar]) {
      // Escape endChar for RegExp (taken from http://stackoverflow.com/a/494122/526741)
      endChar = (endChar+'').replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
      // Match any non-endChar, escaped character, as well as the closing
      // endChar.
      savedInlineRE[endChar] = new RegExp('^(?:[^\\\\]|\\\\.)*?(' + endChar + ')');
    }
    return savedInlineRE[endChar];
  }

  var mode = {
    startState: function() {
      return {
        f: blockNormal,

        prevLineHasContent: false,
        thisLineHasContent: false,

        block: blockNormal,
        htmlState: null,
        indentation: 0,

        inline: inlineNormal,
        text: handleText,

        formatting: false,
        linkText: false,
        linkHref: false,
        linkTitle: false,
        em: false,
        strong: false,
        strike: false,
        header: 0,
        taskList: false,
        list: false,
        listDepth: 0,
        quote: 0,
        trailingSpace: 0,
        trailingSpaceNewLine: false
      };
    },

    copyState: function(s) {
      return {
        f: s.f,

        prevLineHasContent: s.prevLineHasContent,
        thisLineHasContent: s.thisLineHasContent,

        block: s.block,
        htmlState: s.htmlState && CodeMirror.copyState(htmlMode, s.htmlState),
        indentation: s.indentation,

        localMode: s.localMode,
        localState: s.localMode ? CodeMirror.copyState(s.localMode, s.localState) : null,

        inline: s.inline,
        text: s.text,
        formatting: false,
        linkTitle: s.linkTitle,
        em: s.em,
        strong: s.strong,
        strike: s.strike,
        header: s.header,
        taskList: s.taskList,
        list: s.list,
        listDepth: s.listDepth,
        quote: s.quote,
        trailingSpace: s.trailingSpace,
        trailingSpaceNewLine: s.trailingSpaceNewLine,
        mdInside: s.mdInside
      };
    },

    token: function(stream, state) {

      // Reset state.formatting
      state.formatting = false;

      if (stream.sol()) {
        var forceBlankLine = stream.match(/^\s*$/, true) || state.header;

        // Reset state.header
        state.header = 0;

        if (forceBlankLine) {
          state.prevLineHasContent = false;
          return blankLine(state);
        } else {
          state.prevLineHasContent = state.thisLineHasContent;
          state.thisLineHasContent = true;
        }

        // Reset state.taskList
        state.taskList = false;

        // Reset state.code
        state.code = false;

        // Reset state.trailingSpace
        state.trailingSpace = 0;
        state.trailingSpaceNewLine = false;

        state.f = state.block;
        var indentation = stream.match(/^\s*/, true)[0].replace(/\t/g, '    ').length;
        var difference = Math.floor((indentation - state.indentation) / 4) * 4;
        if (difference > 4) difference = 4;
        var adjustedIndentation = state.indentation + difference;
        state.indentationDiff = adjustedIndentation - state.indentation;
        state.indentation = adjustedIndentation;
        if (indentation > 0) return null;
      }
      var result = state.f(stream, state);
      if (stream.start === stream.pos) return this.token(stream, state);
      else return result;
    },

    innerMode: function(state) {
      if (state.block === htmlBlock) return {state: state.htmlState, mode: htmlMode};
      if (state.localState) return {state: state.localState, mode: state.localMode};
      return {state: state, mode: mode};
    },

    blankLine: blankLine,

    getType: getType,

    fold: 'markdown'
  };
  return mode;
}, 'xml');

CodeMirror.defineMIME('text/x-markdown', 'markdown');
var listRE = /^(\s*)([*+-]|(\d+)\.)(\s+)/,
    elistRE = /^(\s*)([*+-]|(\d+)\.)(\s*)$/,
    unorderedBullets = '*+-';

CodeMirror.commands.newlineAndIndentContinueMarkdownList = function(cm) {
  if (cm.getOption('disableInput')) {
    return CodeMirror.Pass;
  }
  var ranges = cm.listSelections(), replacements = [];
  for (var i = 0; i < ranges.length; i++) {
    var pos = ranges[i].head, match, ematch;
    var inList = cm.getStateAfter(pos.line).list !== false;

    if(!ranges[i].empty() || (ematch = cm.getLine(pos.line).match(elistRE))){
      cm.execCommand('delLineLeft');
      cm.execCommand('newlineAndIndent');
      return;
    }

    if (!ranges[i].empty() || !inList || !(match = cm.getLine(pos.line).match(listRE))) {
      cm.execCommand('newlineAndIndent');
      return;
    }

    var indent = match[1], after = match[4];
    var bullet = unorderedBullets.indexOf(match[2]) >= 0
      ? match[2]
      : (parseInt(match[3], 10) + 1) + '.';

    replacements[i] = '\n' + indent + bullet + after;
  }

  cm.replaceSelections(replacements);
};
var isMac =  /Mac/.test(navigator.platform);

var toolbarBtns = {
  bold: {
    name: 'bold',
    title: 'Bold',
    shortcut: 'Cmd-B'
  },
  italic: {
    name: 'italic',
    title: 'Italic',
    shortcut: 'Cmd-I'
  },
  strike: {
    name: 'strike',
    title: 'Strike',
    shortcut: 'Cmd-.'
  },
  heading: {
    name: 'heading',
    title: 'Heading',
    shortcut: 'Cmd-Alt-.'
  },
  quote: {
    name: 'quote',
    title: 'Blockquote',
    shortcut: 'Cmd-\''
  },
  ul: {
    name: 'ul',
    title: 'Unordered list',
    shortcut: 'Cmd-L'
  },
  ol: {
    name: 'ol',
    title: 'Ordered list',
    shortcut: 'Cmd-Alt-L'
  },
  indent: {
    name: 'indent',
    title: 'Indent',
    shortcut: 'Cmd-['
  },
  outdent: {
    name: 'outdent',
    title: 'OUtdent',
    shortcut: 'Cmd-]'
  },
  code: {
    name: 'code',
    title: 'Code',
    shortcut: 'Cmd-\/'
  },
  link: {
    name: 'link',
    title: 'Link',
    shortcut: 'Cmd-K'
  },
  image: {
    name: 'image',
    title: 'Image',
    shortcut: 'Cmd-Alt-I'
  },
  video: {
    name: 'video',
    title: 'Video',
    shortcut: 'Cmd-Alt-V'
  }
};

var defaults = {
  el: '',
  focus: false,
  toolbar: true,
  statusbar: true,
  plugins: false,
  buttons: ['bold', 'italic', 'strike', 'heading', 'quote', 'ul', 'ol', 'indent', 'outdent', 'code', 'link', 'image', 'video'],
  status: ['lines', 'words', 'chars', 'cursor']


  // functionality to add external functionality as adding modals
  // dialogs, overlays, etc, include in the library only.
  // make no dependencies other than codemirror and marked
};

function noop() {}

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

function attr(elem, name, val){
  if (val === undefined){
    return elem.getAttribute(name);
  }
  elem.setAttribute(name, val);
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

function bindEvent(ev, el, listener){
  el.addEventListener(ev, listener, false);
}

function unbindEvent(ev, el, listener){
  el.removeEventListener(ev, listener, false);
}

function contains(array, value) {
  for (var i = 0; i < array.length; i++) {
    if (array[i] === value) {
      return true;
    }
  }
  return false;
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

function action(context, name){
  context._action(name);
}

function bindAction(e){
  var context = e.target.context;
  var name = e.target.name;
  action(context, name);
}

function fixShortcut(text){
  if (isMac) {
    text = text.replace('Ctrl', 'Cmd');
  } else {
    text = text.replace('Cmd', 'Ctrl');
  }
  return text;
}

function getState(cm){
  var pos, end;
  pos = pos || cm.getCursor('from');
  end = end || cm.getCursor('to');
  var stat = cm.getTokenAt(pos, true);

  if(/^(\s*|\n)(\*|\-|\+|\d+\.)\s/.test(cm.getRange(pos, end)) && !cm.getLine(pos.line-1)){
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
      case 'comment':
        ret.code = true;
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
  obj.cm = args[0];
  obj.name = args[1];
  obj.state = getState(args[0]);
  obj.instate = obj.state[obj.name] || false;
  obj.start = args[2];
  obj.end = args[3];
  obj.startPoint = args[0].getCursor('from');
  obj.endPoint = args[0].getCursor('to');

  return obj;
}

function replaceAction(){
  var params = getParams(arguments);
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
    case 'code':
      stext = stext.replace(/^(.*)?(`)(\S+.*)?$/, '$1$3');
      etext = etext.replace(/(.*\S+)(`)(\s+.*)?$/, '$1$3');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 1) : nstart.ch = start.ch + 1;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 1) : nend.ch = end.ch + 1;
      break;
    case 'link':
      stext = stext.replace(/(.*)?(\[)(\S+.*)?/, '$1');
      etext = etext.replace(/(]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.?[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\))(\s+.*)?/, '$2');
      params.instate ? (nstart.ch = 0, ssel.ch = start.ch - 1) : nstart.ch = start.ch + selection.length + 3;
      params.instate ? (nend.ch = text.length, esel.ch = end.ch - 1) : nend.ch = end.ch + params.end.length;
      break;
    case 'image':
    case 'video':
      break;
    default:
      break;
  }

  if (params.name === 'image' || params.name === 'video'){
    return;
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
}

function toggleAction(){
  var params = getParams(arguments);
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
      stext = stext.split('').reverse().join('').replace(/(\*|_){2}/, '').split('').reverse().join('');
      etext = etext.replace(/(\*|_){2}/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - 2) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch ): nend.ch = end.ch + params.end.length;
      break;
    case 'italic':
      stext = stext.split('').reverse().join('').replace(/(\*|_)/, '').split('').reverse().join('');
      etext = etext.replace(/(\*|_)/, '');
      params.instate ? (nstart.ch = 0, scur = start.ch - 1) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch) : nend.ch = end.ch + params.end.length;
      break;
    case 'strike':
      stext = stext.split('').reverse().join('').replace(/(~){2}/, '').split('').reverse().join('');
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
    case 'code':
      stext = stext.replace(/(`)/, '');
      etext = etext.replace(/(`)/, '');
      params.instate ? (nstart.ch = 0, scur = start.ch - 1) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch) : nend.ch = end.ch + params.end.length;
      break;
    case 'link':
      stext = stext.replace(/(\[)/, '');
      etext = etext.replace(/]\(https?:\/\/\)|]\(https?:\/\/[-a-zA-Z0-9@:%._\+~#=]{2,256}\.?[a-z]{2,4}\b[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*\)/, '');
      params.instate ? (nstart.ch = 0, scur.ch = start.ch - params.start.length) : nstart.ch = start.ch + params.start.length;
      params.instate ? (nend.ch = text.length, ecur.ch = end.ch) : nend.ch = end.ch + params.end.length;
      break;
    case 'image':
    case 'video':
      break;
    default:
      break;
  }

  if(params.name === 'image' || params.name === 'video'){
    return;
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
}

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
// Keep thinking about this.
// Look at redactors api
var buttonApi = function(){

  var self = this;

  function getToolbar(){
    return document.querySelector('.kramdown-toolbar');
  }

  function getTooltip(){
    return document.querySelector('.kramdown-tooltip');
  }

  function bindShortcut(name, callback){
    self.editor.options['extraKeys'][name] = callback;
  }

  function unbindShortcut(name){
    delete self.editor.options['extraKeys'][name];
  }

  var api = {
    getToolbarItem: function(name){
      var toolbar = getToolbar();
      return toolbar.querySelector('.kramdown-toolbar-' + name);
    },
    addToolbarItem: function(){
      var btn = {};
      if(arguments.length === 1){
        if (typeof arguments[0] === 'object'){
          if (!arguments[0].hasOwnProperty('name')){
            return;
          }
          if(!arguments[0].hasOwnProperty('shortcut')){
            arguments[0].shortcut = null;
          }
          btn = arguments[0];
        }
        if (typeof arguments[0] === 'string'){
          btn = {};
          btn.name = arguments[0];
          btn.title = arguments[0].charAt(0).toUpperCase() + arguments[0].slice(1);
        }
      } else {
        btn.name = arguments[0];
        btn.title = arguments[1];
        btn.shortcut = arguments[2] !== undefined ? arguments[2] : null;
      }

      var items = this._buildToolbarItem(btn);
      var list = document.createElement('li');
      var tooltip = getTooltip();
      var toolbar = getToolbar();

      list.appendChild(items.el);
      toolbar.appendChild(list);
      tooltip.appendChild(items.et);

      return items.el;
    },
    removeToolbarItem: function(name){
      var toolbar, tooltip, bar, tip;

      toolbar = getToolbar();
      tooltip = getTooltip();
      bar = toolbar.querySelector('.kramdown-toolbar-' + name);
      tip = tooltip.querySelector('.kramdown-tooltip-' + name);

      unbindShortcut(toolbarBtns[name].shortcut);
      toolbar.removeChild(bar.parentNode);
      tooltip.removeChild(tip);
    },
    addToolbarItemCallback: function(name, callback){
      var btn;
      btn = api.getToolbarItem(name);
      bindShortcut(name, callback);
      btn.addEventListener('click', callback);

      return btn;
    },
    addToolbarItemDropdown: function(button, dropdown){
        var list, item, link;
        list = document.createElement('ul');

        addClass(list, 'kramdown-toolbar-dropdown');
        addClass(button.parentNode, 'kramdown-has-dropdown');

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
          e.target.callback.call(this);
          self.editor.focus();
          hideDropdown(e);
        }

        for (var i = 0; i < dropdown.length; i++){
          item = document.createElement('li');
          link = document.createElement('a');

          link.innerHTML = dropdown[i].name;
          link.callback = dropdown[i].callback;
          attr(link, 'href', 'javascript:void(0)');
          addClass(link, 'kramdown-toolbar-' + dropdown[i].title);
          bindEvent('click', link, callback);

          if(dropdown[i].shortcut){
            bindShortcut(dropdown[i].shortcut, dropdown[i].callback);
          }

          item.appendChild(link);
          list.appendChild(item);
        }

        bindEvent('click', button, showDropdown);
        bindEvent('click', document, hideDropdown);
        unbindEvent('click', button, bindAction);

        button.parentNode.appendChild(list);
        return button;
    }
  };
  this._bindObject(api);

  return {
    get: api.getToolbarItem,
    add: api.addToolbarItem,
    remove: api.removeToolbarItem,
    addCallback: api.addToolbarItemCallback,
    addDropdown: api.addToolbarItemDropdown
  };
};

var pluginApi = function(){
  if(! this.options.plugins || typeof this.options.plugins === 'string'){
    return;
  }

  if(typeof this.options.plugins === 'object'){
    var items = {};
    var plugins = this.options.plugins;
    for (var i = 0; i < plugins.length; i++){
      var pname = plugins[i];
      if(! KramdownPlugins[pname]){
        return;
      }
      items[pname] = KramdownPlugins[pname];
    }
    return items;
  }
};

Kramdown.prototype._bindObject = function(obj){
  for (var method in obj){
    obj[method].bind(this);
  }
};

Kramdown.prototype._bindMethods = function(obj, self){
  for (var key in obj){
    if(obj.hasOwnProperty(key)){
      self[key] = obj[key].bind(this);
    }
  }
};

Kramdown.prototype._initButtonApi = function(){
  this.button = {};
  this._bindMethods(buttonApi.call(this), this.button);
};

Kramdown.prototype._initPlugins = function(plugins){
  try{
    for (var key in plugins){
      this[plugins[key]].init();
    }
  } catch (err) {
    if(err){
      console.warn('Please enable the toolbar to use the underlying apis');
    }
    return;
  }
};

Kramdown.prototype._initPluginApi = function(){
  var plugins = pluginApi.call(this);
  this._bindMethods(plugins, this);
  for (var key in plugins){
    this._bindMethods(plugins[key].call(this), this[key]);
    this[key].init();
  }
};

Kramdown.prototype._initApi = function(){
  // Bootstrap modules in order
  this._initButtonApi();
  this._initPluginApi();
};

Kramdown.prototype._init = function(){
  this._initEditor();
  this._initApi();
};

Kramdown.prototype._initEditor = function(){
  var options = this.options, el, wrapper;

  el = options.el;
  wrapper = document.createElement('div');
  addClass(wrapper, 'kramdown-box');

  // TODO: Implement a localstorage mechanism to find out
  // whether something is stored in localstorage, and if yes
  // then throw its value into the editor
  this.editor = CodeMirror.fromTextArea(el, {
    mode: 'markdown',
    theme: 'paper',
    indentSize: 2,
    indentWithTabs: true,
    lineNumbers: false,
    lineWrapping: true,
    autofocus: true,
  });
  this.editor.options['extraKeys'] = {};
  //addClass(this.editor.getWrapperElement(), 'kramdown-editor');

  wrapper.appendChild(this.editor.getWrapperElement());
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


Kramdown.prototype._buildToolbarShortcut = function(button){
  var map = {}, self = this;
  map.shortcut = fixShortcut(button.shortcut);

  if (!contains(this.options.buttons, button.name)){
    map.function = function() {
      self.button.get(button.name).click();
    };
  } else {
    map.function = function() { action(self, button.name); };
  }

  return map;
};


Kramdown.prototype._buildTooltipItem = function(button){
  var tt = document.createElement('span');
  addClass(tt, 'kramdown-tooltip-' + button.name);

  // Think about this
  //if(button.shortcut !== null){
  //  tt.innerHTML = button.title + ' - ' + button.shortcut;
  //} else {
  //  tt.innerHTML = button.title;
  //}

  tt.innerHTML = button.title;

  return tt;
};

Kramdown.prototype._buildToolbarItem = function(button){
  var li, tip, link, name, map;
  name = button.name;
  link = document.createElement('a');
  li = document.createElement('li');
  tip = this._buildTooltipItem(button);

  if(button.shortcut !== null){
    map = this._buildToolbarShortcut(button);
    this.editor.options['extraKeys'][map.shortcut] = map.function;
  }

  attr(link, 'href', 'javascript:void(0)');
  attr(link, 'name', name);
  addClass(link, 'kramdown-toolbar-' + name);

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
  bindEvent('click', link, bindAction);
  bindEvent('mouseover', link, mover);
  bindEvent('mouseout', link, mout);

  li.appendChild(link);
  return { el: link, et: tip };
};

Kramdown.prototype._createToolbar = function(buttons){
  var wrapper, toolbar, tooltip;

  wrapper = this.editor.getWrapperElement();
  toolbar = document.createElement('ul');
  tooltip = document.createElement('div');

  addClass(toolbar, 'kramdown-toolbar');
  addClass(tooltip, 'kramdown-tooltip');

  for (var i = 0; i < buttons.length; i++){
    var items = this._buildToolbarItem(toolbarBtns[buttons[i]]);
    var list = document.createElement('li');

    list.appendChild(items.el);
    toolbar.appendChild(list);
    tooltip.appendChild(items.et);
  }

  wrapper.parentNode.insertBefore(toolbar, wrapper);
  wrapper.parentNode.insertBefore(tooltip, wrapper);
};

Kramdown.prototype._buildStatusbarItem = function(name){
  var cm = this.editor, el;
  el = document.createElement('span');
  addClass(el, name);
  el.innerHTML = '0';
  switch(name) {
    case 'lines':
      this.editor.on('update', function() {
        if(cm.getValue() !== '') {
          el.innerHTML = cm.lineCount();
        } else {
          el.innerHTML = '0';
        }
      });
      break;
    case 'words':
      this.editor.on('update', function(){
        if(cm.getValue() !== ''){
          el.innerHTML = cm.getValue().split('\n').join(' ').split(' ').length;
        } else {
          el.innerHTML = '0';
        }
      });
      break;
    case 'chars':
      this.editor.on('update', function() {
        el.innerHTML = cm.getValue().length;
      });
      break;
    case 'cursor':
      el.innerHTML = '0:0';
      this.editor.on('cursorActivity', function() {
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
  var statusbar, wrapper = this.editor.getWrapperElement();
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

Kramdown.prototype._action = function(name){
  var cm = this.editor, action;
  if(cm.getSelection() !== ''){
    action = replaceAction;
  } else {
    action = toggleAction;
  }

  switch(name){
    case 'bold':
      action.call(this, cm, name, '**');
      break;
    case 'italic':
      action.call(this, cm, name, '*');
      break;
    case 'strike':
      action.call(this, cm, name, '~~');
      break;
    case 'heading':
      action.call(this, cm, name, '## ', null);
      break;
    case 'quote':
      action.call(this, cm, name, '> ', null);
      break;
    case 'ul':
      action.call(this, cm, name, '- ', null);
      break;
    case 'ol':
      action.call(this, cm, name, '1. ', null);
      break;
    case 'indent':
      action.call(this, cm, name, null, null);
      break;
    case 'outdent':
      action.call(this, cm, name, null, null);
      break;
    case 'code':
      action.call(this, cm, name, '`');
      break;
    case 'link':
      action.call(this, cm, name, '[', '](http://)');
      break;
    case 'image':
      action.call(this, cm, name, '![', '](http://)');
      break;
    case 'video':
      action.call(this, cm, name, '<iframe src="', '"></iframe>');
      break;
    default:
      break;
  }
};

global.Kramdown = Kramdown;

})(this);