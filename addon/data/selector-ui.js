/* globals util, window, document, console */
/* exported ui */

var isChrome = false;

const ui = (function () { // eslint-disable-line no-unused-vars
  let exports = {};

  // The <body> tag itself can have margins and offsets, which need to be used when
  // setting the position of the boxEl.
  function getBodyRect() {
    if (getBodyRect.cached) {
      return getBodyRect.cached;
    }
    let rect = document.body.getBoundingClientRect();
    let cached = {
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      right: rect.right + window.scrollX
    };
    // FIXME: I can't decide when this is necessary
    // *not* necessary on http://patriciogonzalezvivo.com/2015/thebookofshaders/
    // (actually causes mis-selection there)
    // *is* necessary on http://atirip.com/2015/03/17/sorry-sad-state-of-matrix-transforms-in-browsers/
    cached = {top: 0, bottom: 0, left: 0, right: 0};
    getBodyRect.cached = cached;
    return cached;
  }

  function isHeader(el) {
    while (el) {
      if (el.className &&
          (el.className.indexOf("pageshot-saver") !== -1 ||
           el.className.indexOf("pageshot-myshots") !== -1 ||
           el.className.indexOf("pageshot-visible") !== -1 ||
           el.className.indexOf("pageshot-full-page") !== -1)) {
        return true;
      }
      el = el.parentNode;
    }
    return false;
  }
  exports.isHeader = isHeader;

  function makeEl(tagName, className) {
    let el = document.createElement(tagName);
    if (className) {
      el.className = className;
    }
    return el;
  }

  /** Represents the shadow overlay that covers the whole page */
  let WholePageOverlay = exports.WholePageOverlay = {

    display: function (callbacks) {
      if (! this.overlayEl) {
        this.overlayEl = makeEl("div", "pageshot-preview-overlay");
        let instructions = makeEl("div", "pageshot-preview-instructions");
        instructions.textContent = "Drag or click on the page to select a region. Press ESC to cancel.";
        this.overlayEl.appendChild(instructions);
        let button = makeEl("div", "pageshot-myshots");
        button.addEventListener("click", callbacks.onOpenMyShots, false);
        let myShotsPre = makeEl("div", "pageshot-pre-myshots");
        button.appendChild(myShotsPre);
        let text = makeEl("div", "pageshot-myshots-text");
        text.textContent = "My Shots";
        button.appendChild(text);
        let myShotsPost = makeEl("div", "pageshot-post-myshots");
        button.appendChild(myShotsPost);
        this.overlayEl.appendChild(button);
        let visibleButton = makeEl("div", "pageshot-overlay-button pageshot-visible");
        visibleButton.textContent = "Save visible";
        visibleButton.addEventListener("click", callbacks.onClickVisible, false);
        this.overlayEl.appendChild(visibleButton);
        let fullPageButton = makeEl("div", "pageshot-overlay-button pageshot-full-page");
        fullPageButton.textContent = "Save full page";
        fullPageButton.addEventListener("click", callbacks.onClickFullPage, false);
        this.overlayEl.appendChild(fullPageButton);

        document.body.appendChild(this.overlayEl);
      }
    },

    remove: function () {
      util.removeNode(this.overlayEl);
      this.overlayEl = null;
    },

    el: null
  };

  let movements = ["topLeft", "top", "topRight", "left", "right", "bottomLeft", "bottom", "bottomRight"];

  /** Creates the selection box */
  exports.Box = {

    display: function (pos, callbacks) {
      this._createEl();
      if (callbacks !== undefined && callbacks.cancel) {
        // We use onclick here because we don't want addEventListener
        // to add multiple event handlers to the same button
        this.cancel.onclick = callbacks.cancel;
        this.cancel.style.display = "";
      } else {
        this.cancel.style.display = "none";
      }
      if (callbacks !== undefined && callbacks.save) {
        // We use onclick here because we don't want addEventListener
        // to add multiple event handlers to the same button
        this.save.removeAttribute("disabled");
        this.save.onclick = (e) => {
          this.save.setAttribute("disabled", "true");
          callbacks.save(e);
        };
        this.save.style.display = "";
      } else {
        this.save.style.display = "none";
      }
      let bodyRect = getBodyRect();
      // Note, document.documentElement.scrollHeight is zero on some strange pages (such as the page created when you load an image):
      let docHeight = Math.max(document.documentElement.scrollHeight || 0, document.body.scrollHeight);
      let docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      if ((pos.right - pos.left) < 78 || (pos.bottom - pos.top) < 78) {
        this.el.classList.add("pageshot-small-selection");
      } else {
        this.el.classList.remove("pageshot-small-selection");
      }
      this.el.style.top = (pos.top - bodyRect.top) + "px";
      this.el.style.left = (pos.left - bodyRect.left) + "px";
      this.el.style.height = (pos.bottom - pos.top - bodyRect.top) + "px";
      this.el.style.width = (pos.right - pos.left - bodyRect.left) + "px";
      this.bgTop.style.top = "0px";
      this.bgTop.style.height = (pos.top - bodyRect.top) + "px";
      this.bgTop.style.left = "0px";
      this.bgTop.style.width = docWidth + "px";
      this.bgBottom.style.top = (pos.bottom - bodyRect.top) + "px";
      this.bgBottom.style.height = docHeight - (pos.bottom - bodyRect.top) + "px";
      this.bgBottom.style.left = "0px";
      this.bgBottom.style.width = docWidth + "px";
      this.bgLeft.style.top = (pos.top - bodyRect.top) + "px";
      this.bgLeft.style.height = pos.bottom - pos.top  + "px";
      this.bgLeft.style.left = "0px";
      this.bgLeft.style.width = (pos.left - bodyRect.left) + "px";
      this.bgRight.style.top = (pos.top - bodyRect.top) + "px";
      this.bgRight.style.height = pos.bottom - pos.top + "px";
      this.bgRight.style.left = (pos.right - bodyRect.left) + "px";
      this.bgRight.style.width = docWidth - (pos.right - bodyRect.left) + "px";
      WholePageOverlay.remove();
    },

    remove: function () {
      for (let name of ["el", "bgTop", "bgLeft", "bgRight", "bgBottom"]) {
        util.removeNode(this[name]);
        this[name] = null;
      }
    },

    _createEl: function () {
      let boxEl = this.el;
      if (boxEl) {
        return;
      }
      boxEl = makeEl("div", "pageshot-highlight");
      let buttons = makeEl("div", "pageshot-highlight-buttons");
      let cancel = makeEl("button", "pageshot-highlight-button-cancel");
      cancel.textContent = "Cancel";
      buttons.appendChild(cancel);
      let save = makeEl("button", "pageshot-highlight-button-save");
      save.textContent = "Save";
      buttons.appendChild(save);
      this.cancel = cancel;
      this.save = save;
      boxEl.appendChild(buttons);
      for (let name of movements) {
        let elTarget = makeEl("div", "pageshot-mover-target pageshot-" + name);
        let elMover = makeEl("div", "pageshot-mover");
        elTarget.appendChild(elMover);
        boxEl.appendChild(elTarget);
      }
      this.bgTop = makeEl("div", "pageshot-bghighlight");
      document.body.appendChild(this.bgTop);
      this.bgLeft = makeEl("div", "pageshot-bghighlight");
      document.body.appendChild(this.bgLeft);
      this.bgRight = makeEl("div", "pageshot-bghighlight");
      document.body.appendChild(this.bgRight);
      this.bgBottom = makeEl("div", "pageshot-bghighlight");
      document.body.appendChild(this.bgBottom);
      document.body.appendChild(boxEl);
      this.el = boxEl;
    },

    draggerDirection: function (target) {
      while (target) {
        if (target.nodeType == document.ELEMENT_NODE) {
          if (target.classList.contains("pageshot-mover-target")) {
            for (let name of movements) {
              if (target.classList.contains("pageshot-" + name)) {
                return name;
              }
            }
            console.warn("Got pageshot-mover-target that wasn't a specific direction");
          }
        }
        target = target.parentNode;
      }
      return null;
    },

    isSelection: function (target) {
      while (target) {
        if (target.nodeType == document.ELEMENT_NODE && target.classList.contains("pageshot-highlight")) {
          return true;
        }
        target = target.parentNode;
      }
      return false;
    },

    el: null,
    boxTopEl: null,
    boxLeftEl: null,
    boxRightEl: null,
    boxBottomEl: null
  };

  /** Displays the box which allows the user to choose between selecting a region,
      archiving the page, or going to my shots.
  */
  exports.SelectMode = {
    display: function (callbacks) {
      if (this.selectModeBackground === undefined) {
        this.selectModeBackground = makeEl("div", "pageshot-select-mode-background");
        this.selectModeBackground.id = "pageshot-select-mode-background";
        let selectMode = makeEl("div", "pageshot-select-mode");
        selectMode.textContent = "Page Shot";
        this.selectModeBackground.appendChild(selectMode);
        let modes = makeEl("div");
        modes.style.textAlign = "center";
        let chooseRegionMode = makeEl("button", "pageshot-select-mode-square-button");
        let regionImg = makeEl("img");
        // I used the website here to make these https://www.base64-image.de/
        // and the images are from https://github.com/mozilla-services/pageshot/issues/1191
        regionImg.src = "data:image/png;base64,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";
        chooseRegionMode.appendChild(regionImg);
        chooseRegionMode.appendChild(document.createTextNode("Screenshot Region"));
        chooseRegionMode.addEventListener("click", callbacks.onChooseRegionMode, false);
        modes.appendChild(chooseRegionMode);
        /*let chooseArchiveMode = document.createElement("button");
        chooseArchiveMode.className = "pageshot-select-mode-square-button";
        chooseArchiveMode.style.right = "60px";
        let archiveImg = document.createElement("img");
        archiveImg.src = "data:image/png;base64,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"
        chooseArchiveMode.appendChild(archiveImg);
        chooseArchiveMode.appendChild(document.createTextNode("Archive Full Page"));
        chooseArchiveMode.addEventListener("click", callbacks.onChooseArchiveMode, false);
        modes.appendChild(chooseArchiveMode);*/
        selectMode.appendChild(modes);
        let buttons = makeEl("div");
        let cancelButton = makeEl("button", "pageshot-select-mode-button");
        cancelButton.textContent = "Cancel";
        cancelButton.style.left = "0";
        cancelButton.onclick = callbacks.onCancel;
        let myShotsButton = makeEl("button", "pageshot-select-mode-button");
        myShotsButton.textContent = "Open My Shots";
        myShotsButton.style.right = "0";
        myShotsButton.style.backgroundColor = "#248aeb";
        myShotsButton.style.color = "white";
        myShotsButton.onclick = callbacks.onOpenMyShots;

        buttons.appendChild(cancelButton);
        buttons.appendChild(myShotsButton);
        selectMode.appendChild(buttons);
      }
      document.body.appendChild(this.selectModeBackground);
    },

    remove: function () {
      if (this.selectModeBackground !== undefined && this.selectModeBackground.parentNode === document.body) {
        document.body.removeChild(this.selectModeBackground);
      }
    }
  }
  /** Displays the crosshairs that suggest you can select something */
  exports.CrosshairPreview = {

    display: function () {
      if (this.pulseEl) {
        return;
      }
      this.pulseEl = makeEl("div", "pageshot-crosshair-pulse");
      document.body.appendChild(this.pulseEl);
      this.innerPulseEl = makeEl("div", "pageshot-crosshair-inner");
      document.body.appendChild(this.innerPulseEl);
      this.horizEl = makeEl("div", "pageshot-horizcross pageshot-crosshair-preview");
      document.body.appendChild(this.horizEl);
      this.vertEl = makeEl("div", "pageshot-vertcross pageshot-crosshair-preview");
      document.body.appendChild(this.vertEl);
    },

    remove: function () {
      util.removeNode(this.pulseEl);
      util.removeNode(this.innerPulseEl);
      util.removeNode(this.horizEl);
      util.removeNode(this.vertEl);
      this.pulseEl = this.innerPulseEl = this.horizEl = this.vertEl = null;
    },

    pulseEl: null,
    innerPulseEl: null,
    horizEl: null,
    vertEl: null
  };

  /** Displays the crosshairs that follow the mouse */
  exports.Crosshair = {

    display: function (x, y) {
      if (! this.vertEl) {
        this.vertEl = makeEl("div", "pageshot-vertcross");
        document.body.appendChild(this.vertEl);
      }
      if (! this.horizEl) {
        this.horizEl = makeEl("div", "pageshot-horizcross");
        document.body.appendChild(this.horizEl);
      }
      this.vertEl.style.left = (x - window.scrollX) + "px";
      this.horizEl.style.top = (y - window.scrollY) + "px";
    },

    remove: function () {
      util.removeNode(this.vertEl);
      util.removeNode(this.horizEl);
      this.vertEl = this.horizEl = null;
    },

    vertEl: null,
    horizEl: null
  };

  exports.MyShotsReminder = {

    display: function () {
      if (this.dialogEl) {
        return;
      }
      let div = makeEl("div", "pageshot-myshots-reminder");
      if (isChrome) {
        div.className += " pageshot-myshots-reminder-chrome";
      }
      div.innerHTML = `
      <div class="pageshot-panel">
        <div class="pageshot-panel-arrowUp"></div>
        <div class="pageshot-panel-section pageshot-panel-section-header">
          <div class="pageshot-text-section-list">
            Click this button to view all the shots you've taken
          </div>
        </div>
      </div>
      `;
      document.body.appendChild(div);
      this.dialogEl = div;
    },

    remove: function () {
      util.removeNode(this.dialogEl);
      this.dialogEl = null;
    },

    dialogEl: null
  };

  exports.HoverBox = {

    el: null,

    display: function (rect) {
      if (! this.el) {
        this.el = makeEl("div", "pageshot-hover-highlight");
        document.body.appendChild(this.el);
      }
      this.el.style.display = "";
      this.el.style.top = (rect.top - 1) + "px";
      this.el.style.left = (rect.left - 1) + "px";
      this.el.style.width = (rect.right - rect.left + 2) + "px";
      this.el.style.height = (rect.bottom - rect.top + 2) + "px";
    },

    hide: function () {
      if (this.el) {
        this.el.style.display = "none";
      }
    },

    remove: function () {
      util.removeNode(this.el);
      this.el = null;
    }
  };

  /** Removes every UI this module creates */
  exports.remove = function () {
    for (let name in exports) {
      if (typeof exports[name] == "object" && exports[name].remove) {
        exports[name].remove();
      }
    }
  };

  exports.ChromeInterface = {

    onMyShots: null,
    onSave: null,
    onCancel: null,

    display: function () {
      if (! this.el) {
        this.el = makeEl("div", "pageshot-saver");
        this.el.innerHTML = `
        <a class="pageshot-myshots" href="https://pageshot.dev.mozaws.net/shots" target="_blank">
          <span class="pageshot-center">
            <span class="pageshot-pre-myshots"></span>
            <span class="pageshot-myshots-text">My Shots</span>
            <span class="pageshot-post-myshots"></span>
          </span>
        </a>
        <span class="pageshot-save-help">
          Select part of the page to save, or save full page without making a selection
        </span>
        <button class="pageshot-cancel">Cancel</button>
        <button class="pageshot-save">Save Full Page</button>
        `;
        document.body.appendChild(this.el);
        let methods = {
          ".pageshot-myshots": "onMyShots",
          ".pageshot-save": "onSave",
          ".pageshot-cancel": "onCancel"
        };
        Object.keys(methods).forEach((selector) => {
          this.el.querySelector(selector).addEventListener("click", (event) => {
            let result;
            if (this[methods[selector]]) {
              let method = this[methods[selector]];
              result = method.call(this);
            }
            if (result === false) {
              event.preventDefault();
              event.stopPropagation();
              return false;
            }
            return undefined;
          });
        });
        document.body.appendChild(this.el);
      }
    },

    remove: function () {
      util.removeNode(this.el);
      this.el = null;
    },

    el: null
  };

  return exports;
})();
