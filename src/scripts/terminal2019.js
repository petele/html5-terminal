'use strict';
/*
Copyright 2019 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

class Sound {
  #context;
  #sample;
  #source;

  constructor(url) {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!window.AudioContext) {
      console.log('Web Audio not supported.');
      return;
    }
    const context = new window.AudioContext();
    fetch(url)
        .then((response) => {
          return response.arrayBuffer();
        })
        .then((buffer) => {
          context.decodeAudioData(buffer, (ab) => {
            this.#sample = ab;
          });
        })
    this.#context = context;
  }

  play() {
    const context = this.#context;
    if (context.state === 'suspended') {
      context.resume();
    }
    this.#source = context.createBufferSource();
    this.#source.buffer = this.#sample;
    this.#source.looping = false;
    this.#source.connect(context.destination);
    this.#source.start(0);
  }

  stop() {
    if (this.#source) {
      this.#source.disconnect();
    }
  }

}

class HTML5Terminal {
  #VERSION = `2.0.0`;
  #container = document.getElementById('container');
  #cmdLine = this.#container.querySelector('#input-line .cmdline');
  #output = this.#container.querySelector('output');
  #interlace = document.querySelector('.interlace');
  #soundBell = new Sound('/assets/bell.mp3');
  #soundMagicWords = new Sound('/assets/magic_word.mp3');
  #history = [];
  #historyPos = 0;
  #historyTemp = '';
  #CMDS = [
    '3d', 'cat', 'cd', 'cp', 'clear', 'date', 'help', 'install', 'ls', 'mkdir',
    'mv', 'open', 'pwd', 'rm', 'rmdir', 'theme', 'version', 'who', 'wget',
  ];
  #THEMES = ['default', 'cream'];
  #directoryHandle;
  // #worker = new Worker('/scripts/worker2019.js');

  /**
   * Create the SoundDrown app.
   */
  constructor(directoryHandle) {
    this.#directoryHandle = directoryHandle;
    this.#output.addEventListener('DOMSubtreeModified', (e) => {
      this._resizeInterlaceBg(e);
    });
    this.#output.addEventListener('click', (e) => {
      this._clickOnFileOrDir(e);
    });
    this.#cmdLine.addEventListener('click', () =>{
      this._setCursorToEnd();
    });
    this.#cmdLine.addEventListener('keydown', (e) => {
      this._keyboardShortcutHandler(e);
    });
    this.#cmdLine.addEventListener('keyup', (e) => {
      this._historyHandler(e);
    });
    this.#cmdLine.addEventListener('keydown', (e) => {
      this._processNewCommand(e);
    });
    // TODO - focus handling
    // document.body.addEventListener('keydown', (e) => {
    //   this._focusHandler(e);
    // });
    // window.addEventListener('click', () => {
    //   console.log('focus', this.#cmdLine.hasFocus())
    //   this.#cmdLine.focus();
    // });
    const theme = localStorage.theme;
    if (theme) {
      this._setTheme(theme);
    }
    this._print(`<div>Welcome to ${document.title}! (v${this.#VERSION})</div>`);
    this._print(`<div>${new Date().toLocaleString()}</div>`);
    this._print(`<p>Documentation: type "help"</p>`);
    this.#cmdLine.removeAttribute('readonly');
    this.#cmdLine.focus();
    // this._test(directoryHandle);
  }

  _focusHandler(e) {
    console.log('focus', document.activeElement);
  }

  _historyHandler(e) {
    const keyCode = e.keyCode;
    if (history.length === 0) {
      return;
    }
    if (keyCode !== 38 && keyCode !== 40) {
      return;
    }

    let position = this.#historyPos;
    const curLine = this.#cmdLine.value;

    if (this.#history[position]) {
      this.#history[position] = curLine;
    } else {
      this.#historyTemp = curLine;
    }

    if (keyCode === 38) {
      position--;
      if (position < 0) {
        position = 0;
      }
    } else if (keyCode === 40) {
      position++;
      if (position > this.#history.length) {
        position = this.#history.length;
      }
    }

    this.#historyPos = position;
    const newVal = this.#history[position];
    this.#cmdLine.value = newVal ? newVal : this.#historyTemp;
    this._setCursorToEnd();
  }

  _setCursorToEnd() {
    this.#cmdLine.value = this.#cmdLine.value;
  }

  _processNewCommand(e) {
    const keyCode = e.keyCode;
    const currentLine = this.#cmdLine.value.trim();

    // Beep on backspace with no value on command line.
    if (!currentLine && keyCode === 8) {
      this._bell();
      return;
    }

    // Tab
    if (keyCode === 9) {
      e.preventDefault();
      return;
    }

    // Enter
    if (keyCode === 13) {
      if (currentLine) {
        this.#history.push(currentLine);
        this.#historyPos = this.#history.length;
      }
      const line = this.#cmdLine.parentNode.cloneNode(true);
      line.removeAttribute('id');
      line.classList.add('line');
      const input = line.querySelector('input.cmdline');
      input.autofocus = false;
      input.readOnly = true;
      this.#output.appendChild(line);

      if (currentLine.length === 0) {
        return;
      }

      const splitCmdLine = currentLine.split(' ');
      const cmd = splitCmdLine[0].toLowerCase();
      const args = splitCmdLine.splice(1);

      this.#cmdLine.value = '';

      if (cmd === '3d') {
        this._execClear();
        return this._toggle3DView();
      }
      if (cmd === 'clear') {
        return this._execClear();
      }
      if (cmd === 'cat') {
        return this._execCat(args.join(' '));
      }
      if (cmd === 'date') {
        return this._execDate();
      }
      if (cmd === 'exit') {
        return this._execNYI(args);
      }
      if (cmd === 'help') {
        return this._execHelp();
      }
      if (cmd === 'install') {
        return this._execNYI();
      }
      if (cmd === 'ls') {
        return this._execLS(args);
      }
      if (cmd === 'pwd') {
        return this._execNYI();
      }
      if (cmd === 'cd') {
        return this._execNYI(args);
      }
      if (cmd === 'mkdir') {
        return this._execNYI(args);
      }
      if (cmd === 'cp') {
        return this._execNYI(args);
      }
      if (cmd === 'mv') {
        return this._execNYI(args);
      }
      if (cmd === 'open') {
        return this._execNYI(args);
      }
      if (cmd === 'init') {
        return this._execNYI(args);
      }
      if (cmd === 'rm') {
        return this._execNYI(args);
      }
      if (cmd === 'rmdir') {
        return this._execNYI(args);
      }
      if (cmd === 'sudo') {
        return this._execNYI(args);
      }
      if (cmd === 'theme') {
        return this._execTheme(args);
      }
      if (cmd === 'ver' || cmd === 'version') {
        return this._execVersion(args);
      }
      if (cmd === 'wget') {
        return this._execNYI(args);
      }
      if (cmd === 'who') {
        return this._execNYI(args);
      }

      this._print(`<div>${cmd}: command not found.</div>`);
    }
  }

  _execNYI(args) {
    this._print(`<div>Oops, that's not implemented yet.</div>`);
  }

  _execClear() {
    this.#output.innerHTML = '';
    this.#cmdLine.value = '';
    document.documentElement.style.height = '100%';
    this.#interlace.style.height = '100%';
  }

  _execDate() {
    this._print(`<div>${(new Date()).toLocaleString()}`);
  }

  _execHelp() {
    this._print(`<div class="ls-files">${this.#CMDS.join('<br>')}</div>`);
    this._print(`<p>Add files by dragging them from your desktop.</p>`);
  }

  async _execLS() {
    const elems = [];
    const entries = await this.#directoryHandle.getEntries();
    for await (const entry of entries) {
      const cls = entry.isDirectory ? 'folder' : 'file';
      const item = `<span class="${cls}">${entry.name}</span><br>`;
      elems.push(item);
    }
    this._print(`<div class="ls-files">${elems.join('')}</div>`)
  }

  async _execCat(filename) {
    if (!filename) {
      this._print(`usage: cat [filename]`);
      return;
    }
    try {
      const cwd = this.#directoryHandle;
      const fileHandle = await cwd.getFile(filename);
      const file = await fileHandle.getFile();
      const reader = new FileReader();
      const contents = await file.text();
      this._print(`<pre>${contents}</pre>`);
    } catch (ex) {
      console.log('err', ex);
    }
  }


  _execTheme(args) {
    const theme = args.join(' ');
    if (!theme) {
      this._print(`<div>usage: theme &lt;theme&gt;</div>`);
      this._print(`<div>Available themes: ${this.#THEMES.join(', ')}</div>`);
      return;
    }
    if (this.#THEMES.includes(theme)) {
      return this._setTheme(theme);
    }
    this._print(`<div>Error, unknown theme provided.</div>`);
  }

  _execVersion() {
    this._print(`<div>v${this.#VERSION}</div>`);
  }

  _setTheme(theme) {
    if (!theme || theme === 'default') {
      localStorage.removeItem('theme');
      document.body.className = '';
      return;
    }
    document.body.className = theme;
    localStorage.theme = theme;
  }

  _toggle3DView() {}

  _keyboardShortcutHandler(e) {
    // Toggle CRT screen flicker. (CTRL-S)
    if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) {
      this.#container.classList.toggle('flicker');
      const hasFlicker = this.#container.classList.contains('flicker');
      this._print(`<div>Screen flicker: ${hasFlicker ? 'on' : 'off'}</div>`);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Toggle HELP dialog (ESC)
    if (e.keyCode == 27) {
      const elem = document.querySelector('.help');
      elem.classList.toggle('hidden');
      document.body.classList.toggle('dim');
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  }

  _bell() {
    this.#soundBell.play();
  }

  _print(html) {
    this.#output.insertAdjacentHTML('beforeEnd', html);
    this.#cmdLine.scrollIntoView();
  }

  _getDocHeight() {
    const dB = document.body;
    const dDE = document.documentElement;
    return Math.max(
      Math.max(dB.scrollHeight, dDE.scrollHeight),
      Math.max(dB.offsetHeight, dDE.offsetHeight),
      Math.max(dB.clientHeight, dDE.clientHeight),
    );
  }

  _resizeInterlaceBg(e) {
    const docHeight = this._getDocHeight();
    document.documentElement.style.height = `${docHeight}px`;
    this.#interlace.style.height = `${docHeight}px`;
    this.#cmdLine.scrollIntoView();
  }

  _clickOnFileOrDir(e) {}

}
