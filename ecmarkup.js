'use strict';
let sdoBox = {
  init() {
    this.$alternativeId = null;
    this.$outer = document.createElement('div');
    this.$outer.classList.add('toolbox-container');
    this.$container = document.createElement('div');
    this.$container.classList.add('toolbox');
    this.$displayLink = document.createElement('a');
    this.$displayLink.setAttribute('href', '#');
    this.$displayLink.textContent = 'Syntax-Directed Operations';
    this.$displayLink.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      referencePane.showSDOs(sdoMap[this.$alternativeId] || {}, this.$alternativeId);
    });
    this.$container.appendChild(this.$displayLink);
    this.$outer.appendChild(this.$container);
    document.body.appendChild(this.$outer);
  },

  activate(el) {
    clearTimeout(this.deactiveTimeout);
    Toolbox.deactivate();
    this.$alternativeId = el.id;
    let numSdos = Object.keys(sdoMap[this.$alternativeId] || {}).length;
    this.$displayLink.textContent = 'Syntax-Directed Operations (' + numSdos + ')';
    this.$outer.classList.add('active');
    let top = el.offsetTop - this.$outer.offsetHeight;
    let left = el.offsetLeft + 50 - 10; // 50px = padding-left(=75px) + text-indent(=-25px)
    this.$outer.setAttribute('style', 'left: ' + left + 'px; top: ' + top + 'px');
    if (top < document.body.scrollTop) {
      this.$container.scrollIntoView();
    }
  },

  deactivate() {
    clearTimeout(this.deactiveTimeout);
    this.$outer.classList.remove('active');
  },
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof sdoMap == 'undefined') {
    console.error('could not find sdo map');
    return;
  }
  sdoBox.init();

  let insideTooltip = false;
  sdoBox.$outer.addEventListener('pointerenter', () => {
    insideTooltip = true;
  });
  sdoBox.$outer.addEventListener('pointerleave', () => {
    insideTooltip = false;
    sdoBox.deactivate();
  });

  sdoBox.deactiveTimeout = null;
  [].forEach.call(document.querySelectorAll('emu-grammar[type=definition] emu-rhs'), node => {
    node.addEventListener('pointerenter', function () {
      sdoBox.activate(this);
    });

    node.addEventListener('pointerleave', () => {
      sdoBox.deactiveTimeout = setTimeout(() => {
        if (!insideTooltip) {
          sdoBox.deactivate();
        }
      }, 500);
    });
  });

  document.addEventListener(
    'keydown',
    debounce(e => {
      if (e.code === 'Escape') {
        sdoBox.deactivate();
      }
    })
  );
});

'use strict';
function Search(menu) {
  this.menu = menu;
  this.$search = document.getElementById('menu-search');
  this.$searchBox = document.getElementById('menu-search-box');
  this.$searchResults = document.getElementById('menu-search-results');

  this.loadBiblio();

  document.addEventListener('keydown', this.documentKeydown.bind(this));

  this.$searchBox.addEventListener(
    'keydown',
    debounce(this.searchBoxKeydown.bind(this), { stopPropagation: true })
  );
  this.$searchBox.addEventListener(
    'keyup',
    debounce(this.searchBoxKeyup.bind(this), { stopPropagation: true })
  );

  // Perform an initial search if the box is not empty.
  if (this.$searchBox.value) {
    this.search(this.$searchBox.value);
  }
}

Search.prototype.loadBiblio = function () {
  if (typeof biblio === 'undefined') {
    console.error('could not find biblio');
    this.biblio = { refToClause: {}, entries: [] };
  } else {
    this.biblio = biblio;
    this.biblio.clauses = this.biblio.entries.filter(e => e.type === 'clause');
    this.biblio.byId = this.biblio.entries.reduce((map, entry) => {
      map[entry.id] = entry;
      return map;
    }, {});
    let refParentClause = Object.create(null);
    this.biblio.refParentClause = refParentClause;
    let refsByClause = this.biblio.refsByClause;
    Object.keys(refsByClause).forEach(clause => {
      refsByClause[clause].forEach(ref => {
        refParentClause[ref] = clause;
      });
    });
  }
};

Search.prototype.documentKeydown = function (e) {
  if (e.keyCode === 191) {
    e.preventDefault();
    e.stopPropagation();
    this.triggerSearch();
  }
};

Search.prototype.searchBoxKeydown = function (e) {
  e.stopPropagation();
  e.preventDefault();
  if (e.keyCode === 191 && e.target.value.length === 0) {
    e.preventDefault();
  } else if (e.keyCode === 13) {
    e.preventDefault();
    this.selectResult();
  }
};

Search.prototype.searchBoxKeyup = function (e) {
  if (e.keyCode === 13 || e.keyCode === 9) {
    return;
  }

  this.search(e.target.value);
};

Search.prototype.triggerSearch = function () {
  if (this.menu.isVisible()) {
    this._closeAfterSearch = false;
  } else {
    this._closeAfterSearch = true;
    this.menu.show();
  }

  this.$searchBox.focus();
  this.$searchBox.select();
};
// bit 12 - Set if the result starts with searchString
// bits 8-11: 8 - number of chunks multiplied by 2 if cases match, otherwise 1.
// bits 1-7: 127 - length of the entry
// General scheme: prefer case sensitive matches with fewer chunks, and otherwise
// prefer shorter matches.
function relevance(result) {
  let relevance = 0;

  relevance = Math.max(0, 8 - result.match.chunks) << 7;

  if (result.match.caseMatch) {
    relevance *= 2;
  }

  if (result.match.prefix) {
    relevance += 2048;
  }

  relevance += Math.max(0, 255 - result.entry.key.length);

  return relevance;
}

Search.prototype.search = function (searchString) {
  if (searchString === '') {
    this.displayResults([]);
    this.hideSearch();
    return;
  } else {
    this.showSearch();
  }

  if (searchString.length === 1) {
    this.displayResults([]);
    return;
  }

  let results;

  if (/^[\d.]*$/.test(searchString)) {
    results = this.biblio.clauses
      .filter(clause => clause.number.substring(0, searchString.length) === searchString)
      .map(clause => ({ entry: clause }));
  } else {
    results = [];

    for (let i = 0; i < this.biblio.entries.length; i++) {
      let entry = this.biblio.entries[i];
      if (!entry.key) {
        // biblio entries without a key aren't searchable
        continue;
      }

      let match = fuzzysearch(searchString, entry.key);
      if (match) {
        results.push({ entry, match });
      }
    }

    results.forEach(result => {
      result.relevance = relevance(result, searchString);
    });

    results = results.sort((a, b) => b.relevance - a.relevance);
  }

  if (results.length > 50) {
    results = results.slice(0, 50);
  }

  this.displayResults(results);
};
Search.prototype.hideSearch = function () {
  this.$search.classList.remove('active');
};

Search.prototype.showSearch = function () {
  this.$search.classList.add('active');
};

Search.prototype.selectResult = function () {
  let $first = this.$searchResults.querySelector('li:first-child a');

  if ($first) {
    document.location = $first.getAttribute('href');
  }

  this.$searchBox.value = '';
  this.$searchBox.blur();
  this.displayResults([]);
  this.hideSearch();

  if (this._closeAfterSearch) {
    this.menu.hide();
  }
};

Search.prototype.displayResults = function (results) {
  if (results.length > 0) {
    this.$searchResults.classList.remove('no-results');

    let html = '<ul>';

    results.forEach(result => {
      let entry = result.entry;
      let id = entry.id;
      let cssClass = '';
      let text = '';

      if (entry.type === 'clause') {
        let number = entry.number ? entry.number + ' ' : '';
        text = number + entry.key;
        cssClass = 'clause';
        id = entry.id;
      } else if (entry.type === 'production') {
        text = entry.key;
        cssClass = 'prod';
        id = entry.id;
      } else if (entry.type === 'op') {
        text = entry.key;
        cssClass = 'op';
        id = entry.id || entry.refId;
      } else if (entry.type === 'term') {
        text = entry.key;
        cssClass = 'term';
        id = entry.id || entry.refId;
      }

      if (text) {
        // prettier-ignore
        html += `<li class=menu-search-result-${cssClass}><a href="${makeLinkToId(id)}">${text}</a></li>`;
      }
    });

    html += '</ul>';

    this.$searchResults.innerHTML = html;
  } else {
    this.$searchResults.innerHTML = '';
    this.$searchResults.classList.add('no-results');
  }
};

function Menu() {
  this.$toggle = document.getElementById('menu-toggle');
  this.$menu = document.getElementById('menu');
  this.$toc = document.querySelector('menu-toc > ol');
  this.$pins = document.querySelector('#menu-pins');
  this.$pinList = document.getElementById('menu-pins-list');
  this.$toc = document.querySelector('#menu-toc > ol');
  this.$specContainer = document.getElementById('spec-container');
  this.search = new Search(this);

  this._pinnedIds = {};
  this.loadPinEntries();

  // toggle menu
  this.$toggle.addEventListener('click', this.toggle.bind(this));

  // keydown events for pinned clauses
  document.addEventListener('keydown', this.documentKeydown.bind(this));

  // toc expansion
  let tocItems = this.$menu.querySelectorAll('#menu-toc li');
  for (let i = 0; i < tocItems.length; i++) {
    let $item = tocItems[i];
    $item.addEventListener('click', event => {
      $item.classList.toggle('active');
      event.stopPropagation();
    });
  }

  // close toc on toc item selection
  let tocLinks = this.$menu.querySelectorAll('#menu-toc li > a');
  for (let i = 0; i < tocLinks.length; i++) {
    let $link = tocLinks[i];
    $link.addEventListener('click', event => {
      this.toggle();
      event.stopPropagation();
    });
  }

  // update active clause on scroll
  window.addEventListener('scroll', debounce(this.updateActiveClause.bind(this)));
  this.updateActiveClause();

  // prevent menu scrolling from scrolling the body
  this.$toc.addEventListener('wheel', e => {
    let target = e.currentTarget;
    let offTop = e.deltaY < 0 && target.scrollTop === 0;
    if (offTop) {
      e.preventDefault();
    }
    let offBottom = e.deltaY > 0 && target.offsetHeight + target.scrollTop >= target.scrollHeight;

    if (offBottom) {
      e.preventDefault();
    }
  });
}

Menu.prototype.documentKeydown = function (e) {
  e.stopPropagation();
  if (e.keyCode === 80) {
    this.togglePinEntry();
  } else if (e.keyCode > 48 && e.keyCode < 58) {
    this.selectPin(e.keyCode - 49);
  }
};

Menu.prototype.updateActiveClause = function () {
  this.setActiveClause(findActiveClause(this.$specContainer));
};

Menu.prototype.setActiveClause = function (clause) {
  this.$activeClause = clause;
  this.revealInToc(this.$activeClause);
};

Menu.prototype.revealInToc = function (path) {
  let current = this.$toc.querySelectorAll('li.revealed');
  for (let i = 0; i < current.length; i++) {
    current[i].classList.remove('revealed');
    current[i].classList.remove('revealed-leaf');
  }

  current = this.$toc;
  let index = 0;
  outer: while (index < path.length) {
    let children = current.children;
    for (let i = 0; i < children.length; i++) {
      if ('#' + path[index].id === children[i].children[1].hash) {
        children[i].classList.add('revealed');
        if (index === path.length - 1) {
          children[i].classList.add('revealed-leaf');
          let rect = children[i].getBoundingClientRect();
          // this.$toc.getBoundingClientRect().top;
          let tocRect = this.$toc.getBoundingClientRect();
          if (rect.top + 10 > tocRect.bottom) {
            this.$toc.scrollTop =
              this.$toc.scrollTop + (rect.top - tocRect.bottom) + (rect.bottom - rect.top);
          } else if (rect.top < tocRect.top) {
            this.$toc.scrollTop = this.$toc.scrollTop - (tocRect.top - rect.top);
          }
        }
        current = children[i].querySelector('ol');
        index++;
        continue outer;
      }
    }
    console.log('could not find location in table of contents', path);
    break;
  }
};

function findActiveClause(root, path) {
  let clauses = getChildClauses(root);
  path = path || [];

  for (let $clause of clauses) {
    let rect = $clause.getBoundingClientRect();
    let $header = $clause.querySelector('h1');
    let marginTop = Math.max(
      parseInt(getComputedStyle($clause)['margin-top']),
      parseInt(getComputedStyle($header)['margin-top'])
    );

    if (rect.top - marginTop <= 1 && rect.bottom > 0) {
      return findActiveClause($clause, path.concat($clause)) || path;
    }
  }

  return path;
}

function* getChildClauses(root) {
  for (let el of root.children) {
    switch (el.nodeName) {
      // descend into <emu-import>
      case 'EMU-IMPORT':
        yield* getChildClauses(el);
        break;

      // accept <emu-clause>, <emu-intro>, and <emu-annex>
      case 'EMU-CLAUSE':
      case 'EMU-INTRO':
      case 'EMU-ANNEX':
        yield el;
    }
  }
}

Menu.prototype.toggle = function () {
  this.$menu.classList.toggle('active');
};

Menu.prototype.show = function () {
  this.$menu.classList.add('active');
};

Menu.prototype.hide = function () {
  this.$menu.classList.remove('active');
};

Menu.prototype.isVisible = function () {
  return this.$menu.classList.contains('active');
};

Menu.prototype.showPins = function () {
  this.$pins.classList.add('active');
};

Menu.prototype.hidePins = function () {
  this.$pins.classList.remove('active');
};

Menu.prototype.addPinEntry = function (id) {
  let entry = this.search.biblio.byId[id];
  if (!entry) {
    // id was deleted after pin (or something) so remove it
    delete this._pinnedIds[id];
    this.persistPinEntries();
    return;
  }

  if (entry.type === 'clause') {
    let prefix;
    if (entry.number) {
      prefix = entry.number + ' ';
    } else {
      prefix = '';
    }
    // prettier-ignore
    this.$pinList.innerHTML += `<li><a href="${makeLinkToId(entry.id)}">${prefix}${entry.titleHTML}</a></li>`;
  } else {
    this.$pinList.innerHTML += `<li><a href="${makeLinkToId(entry.id)}">${entry.key}</a></li>`;
  }

  if (Object.keys(this._pinnedIds).length === 0) {
    this.showPins();
  }
  this._pinnedIds[id] = true;
  this.persistPinEntries();
};

Menu.prototype.removePinEntry = function (id) {
  let item = this.$pinList.querySelector(`a[href="${makeLinkToId(id)}"]`).parentNode;
  this.$pinList.removeChild(item);
  delete this._pinnedIds[id];
  if (Object.keys(this._pinnedIds).length === 0) {
    this.hidePins();
  }

  this.persistPinEntries();
};

Menu.prototype.persistPinEntries = function () {
  try {
    if (!window.localStorage) return;
  } catch (e) {
    return;
  }

  localStorage.pinEntries = JSON.stringify(Object.keys(this._pinnedIds));
};

Menu.prototype.loadPinEntries = function () {
  try {
    if (!window.localStorage) return;
  } catch (e) {
    return;
  }

  let pinsString = window.localStorage.pinEntries;
  if (!pinsString) return;
  let pins = JSON.parse(pinsString);
  for (let i = 0; i < pins.length; i++) {
    this.addPinEntry(pins[i]);
  }
};

Menu.prototype.togglePinEntry = function (id) {
  if (!id) {
    id = this.$activeClause[this.$activeClause.length - 1].id;
  }

  if (this._pinnedIds[id]) {
    this.removePinEntry(id);
  } else {
    this.addPinEntry(id);
  }
};

Menu.prototype.selectPin = function (num) {
  document.location = this.$pinList.children[num].children[0].href;
};

let menu;

document.addEventListener('DOMContentLoaded', init);

function debounce(fn, opts) {
  opts = opts || {};
  let timeout;
  return function (e) {
    if (opts.stopPropagation) {
      e.stopPropagation();
    }
    let args = arguments;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      fn.apply(this, args);
    }, 150);
  };
}

let CLAUSE_NODES = ['EMU-CLAUSE', 'EMU-INTRO', 'EMU-ANNEX'];
function findContainer($elem) {
  let parentClause = $elem.parentNode;
  while (parentClause && CLAUSE_NODES.indexOf(parentClause.nodeName) === -1) {
    parentClause = parentClause.parentNode;
  }
  return parentClause;
}

function findLocalReferences(parentClause, name) {
  let vars = parentClause.querySelectorAll('var');
  let references = [];

  for (let i = 0; i < vars.length; i++) {
    let $var = vars[i];

    if ($var.innerHTML === name) {
      references.push($var);
    }
  }

  return references;
}

let REFERENCED_CLASSES = Array.from({ length: 7 }, (x, i) => `referenced${i}`);
function chooseHighlightIndex(parentClause) {
  let counts = REFERENCED_CLASSES.map($class => parentClause.getElementsByClassName($class).length);
  // Find the earliest index with the lowest count.
  let minCount = Infinity;
  let index = null;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] < minCount) {
      minCount = counts[i];
      index = i;
    }
  }
  return index;
}

function toggleFindLocalReferences($elem) {
  let parentClause = findContainer($elem);
  let references = findLocalReferences(parentClause, $elem.innerHTML);
  if ($elem.classList.contains('referenced')) {
    references.forEach($reference => {
      $reference.classList.remove('referenced', ...REFERENCED_CLASSES);
    });
  } else {
    let index = chooseHighlightIndex(parentClause);
    references.forEach($reference => {
      $reference.classList.add('referenced', `referenced${index}`);
    });
  }
}

function installFindLocalReferences() {
  document.addEventListener('click', e => {
    if (e.target.nodeName === 'VAR') {
      toggleFindLocalReferences(e.target);
    }
  });
}

document.addEventListener('DOMContentLoaded', installFindLocalReferences);

// The following license applies to the fuzzysearch function
// The MIT License (MIT)
// Copyright © 2015 Nicolas Bevacqua
// Copyright © 2016 Brian Terlson
// Permission is hereby granted, free of charge, to any person obtaining a copy of
// this software and associated documentation files (the "Software"), to deal in
// the Software without restriction, including without limitation the rights to
// use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is furnished to do so,
// subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
// FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
// COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
// IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
// CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
function fuzzysearch(searchString, haystack, caseInsensitive) {
  let tlen = haystack.length;
  let qlen = searchString.length;
  let chunks = 1;
  let finding = false;

  if (qlen > tlen) {
    return false;
  }

  if (qlen === tlen) {
    if (searchString === haystack) {
      return { caseMatch: true, chunks: 1, prefix: true };
    } else if (searchString.toLowerCase() === haystack.toLowerCase()) {
      return { caseMatch: false, chunks: 1, prefix: true };
    } else {
      return false;
    }
  }

  let j = 0;
  outer: for (let i = 0; i < qlen; i++) {
    let nch = searchString[i];
    while (j < tlen) {
      let targetChar = haystack[j++];
      if (targetChar === nch) {
        finding = true;
        continue outer;
      }
      if (finding) {
        chunks++;
        finding = false;
      }
    }

    if (caseInsensitive) {
      return false;
    }

    return fuzzysearch(searchString.toLowerCase(), haystack.toLowerCase(), true);
  }

  return { caseMatch: !caseInsensitive, chunks, prefix: j <= qlen };
}

let referencePane = {
  init() {
    this.$container = document.createElement('div');
    this.$container.setAttribute('id', 'references-pane-container');

    let $spacer = document.createElement('div');
    $spacer.setAttribute('id', 'references-pane-spacer');

    this.$pane = document.createElement('div');
    this.$pane.setAttribute('id', 'references-pane');

    this.$container.appendChild($spacer);
    this.$container.appendChild(this.$pane);

    this.$header = document.createElement('div');
    this.$header.classList.add('menu-pane-header');
    this.$headerText = document.createElement('span');
    this.$header.appendChild(this.$headerText);
    this.$headerRefId = document.createElement('a');
    this.$header.appendChild(this.$headerRefId);
    this.$closeButton = document.createElement('span');
    this.$closeButton.setAttribute('id', 'references-pane-close');
    this.$closeButton.addEventListener('click', () => {
      this.deactivate();
    });
    this.$header.appendChild(this.$closeButton);

    this.$pane.appendChild(this.$header);
    let tableContainer = document.createElement('div');
    tableContainer.setAttribute('id', 'references-pane-table-container');

    this.$table = document.createElement('table');
    this.$table.setAttribute('id', 'references-pane-table');

    this.$tableBody = this.$table.createTBody();

    tableContainer.appendChild(this.$table);
    this.$pane.appendChild(tableContainer);

    menu.$specContainer.appendChild(this.$container);
  },

  activate() {
    this.$container.classList.add('active');
  },

  deactivate() {
    this.$container.classList.remove('active');
    this.state = null;
  },

  showReferencesFor(entry) {
    this.activate();
    this.state = { type: 'ref', id: entry.id };
    this.$headerText.textContent = 'References to ';
    let newBody = document.createElement('tbody');
    let previousId;
    let previousCell;
    let dupCount = 0;
    this.$headerRefId.textContent = '#' + entry.id;
    this.$headerRefId.setAttribute('href', makeLinkToId(entry.id));
    this.$headerRefId.style.display = 'inline';
    entry.referencingIds
      .map(id => {
        let cid = menu.search.biblio.refParentClause[id];
        let clause = menu.search.biblio.byId[cid];
        if (clause == null) {
          throw new Error('could not find clause for id ' + cid);
        }
        return { id, clause };
      })
      .sort((a, b) => sortByClauseNumber(a.clause, b.clause))
      .forEach(record => {
        if (previousId === record.clause.id) {
          previousCell.innerHTML += ` (<a href="${makeLinkToId(record.id)}">${dupCount + 2}</a>)`;
          dupCount++;
        } else {
          let row = newBody.insertRow();
          let cell = row.insertCell();
          cell.innerHTML = record.clause.number;
          cell = row.insertCell();
          cell.innerHTML = `<a href="${makeLinkToId(record.id)}">${record.clause.titleHTML}</a>`;
          previousCell = cell;
          previousId = record.clause.id;
          dupCount = 0;
        }
      }, this);
    this.$table.removeChild(this.$tableBody);
    this.$tableBody = newBody;
    this.$table.appendChild(this.$tableBody);
  },

  showSDOs(sdos, alternativeId) {
    let rhs = document.getElementById(alternativeId);
    let parentName = rhs.parentNode.getAttribute('name');
    let colons = rhs.parentNode.querySelector('emu-geq');
    rhs = rhs.cloneNode(true);
    rhs.querySelectorAll('emu-params,emu-constraints').forEach(e => {
      e.remove();
    });
    rhs.querySelectorAll('[id]').forEach(e => {
      e.removeAttribute('id');
    });
    rhs.querySelectorAll('a').forEach(e => {
      e.parentNode.replaceChild(document.createTextNode(e.textContent), e);
    });

    // prettier-ignore
    this.$headerText.innerHTML = `Syntax-Directed Operations for<br><a href="${makeLinkToId(alternativeId)}" class="menu-pane-header-production"><emu-nt>${parentName}</emu-nt> ${colons.outerHTML} </a>`;
    this.$headerText.querySelector('a').append(rhs);
    this.showSDOsBody(sdos, alternativeId);
  },

  showSDOsBody(sdos, alternativeId) {
    this.activate();
    this.state = { type: 'sdo', id: alternativeId, html: this.$headerText.innerHTML };
    this.$headerRefId.style.display = 'none';
    let newBody = document.createElement('tbody');
    Object.keys(sdos).forEach(sdoName => {
      let pair = sdos[sdoName];
      let clause = pair.clause;
      let ids = pair.ids;
      let first = ids[0];
      let row = newBody.insertRow();
      let cell = row.insertCell();
      cell.innerHTML = clause;
      cell = row.insertCell();
      let html = '<a href="' + makeLinkToId(first) + '">' + sdoName + '</a>';
      for (let i = 1; i < ids.length; ++i) {
        html += ' (<a href="' + makeLinkToId(ids[i]) + '">' + (i + 1) + '</a>)';
      }
      cell.innerHTML = html;
    });
    this.$table.removeChild(this.$tableBody);
    this.$tableBody = newBody;
    this.$table.appendChild(this.$tableBody);
  },
};

let Toolbox = {
  init() {
    this.$outer = document.createElement('div');
    this.$outer.classList.add('toolbox-container');
    this.$container = document.createElement('div');
    this.$container.classList.add('toolbox');
    this.$outer.appendChild(this.$container);
    this.$permalink = document.createElement('a');
    this.$permalink.textContent = 'Permalink';
    this.$pinLink = document.createElement('a');
    this.$pinLink.textContent = 'Pin';
    this.$pinLink.setAttribute('href', '#');
    this.$pinLink.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      menu.togglePinEntry(this.entry.id);
    });

    this.$refsLink = document.createElement('a');
    this.$refsLink.setAttribute('href', '#');
    this.$refsLink.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      referencePane.showReferencesFor(this.entry);
    });
    this.$container.appendChild(this.$permalink);
    this.$container.appendChild(this.$pinLink);
    this.$container.appendChild(this.$refsLink);
    document.body.appendChild(this.$outer);
  },

  activate(el, entry, target) {
    if (el === this._activeEl) return;
    sdoBox.deactivate();
    this.active = true;
    this.entry = entry;
    this.$outer.classList.add('active');
    this.top = el.offsetTop - this.$outer.offsetHeight;
    this.left = el.offsetLeft - 10;
    this.$outer.setAttribute('style', 'left: ' + this.left + 'px; top: ' + this.top + 'px');
    this.updatePermalink();
    this.updateReferences();
    this._activeEl = el;
    if (this.top < document.body.scrollTop && el === target) {
      // don't scroll unless it's a small thing (< 200px)
      this.$outer.scrollIntoView();
    }
  },

  updatePermalink() {
    this.$permalink.setAttribute('href', makeLinkToId(this.entry.id));
  },

  updateReferences() {
    this.$refsLink.textContent = `References (${this.entry.referencingIds.length})`;
  },

  activateIfMouseOver(e) {
    let ref = this.findReferenceUnder(e.target);
    if (ref && (!this.active || e.pageY > this._activeEl.offsetTop)) {
      let entry = menu.search.biblio.byId[ref.id];
      this.activate(ref.element, entry, e.target);
    } else if (
      this.active &&
      (e.pageY < this.top || e.pageY > this._activeEl.offsetTop + this._activeEl.offsetHeight)
    ) {
      this.deactivate();
    }
  },

  findReferenceUnder(el) {
    while (el) {
      let parent = el.parentNode;
      if (el.nodeName === 'EMU-RHS' || el.nodeName === 'EMU-PRODUCTION') {
        return null;
      }
      if (
        el.nodeName === 'H1' &&
        parent.nodeName.match(/EMU-CLAUSE|EMU-ANNEX|EMU-INTRO/) &&
        parent.id
      ) {
        return { element: el, id: parent.id };
      } else if (el.nodeName === 'EMU-NT') {
        if (
          parent.nodeName === 'EMU-PRODUCTION' &&
          parent.id &&
          parent.id[0] !== '_' &&
          parent.firstElementChild === el
        ) {
          // return the LHS non-terminal element
          return { element: el, id: parent.id };
        }
        return null;
      } else if (
        el.nodeName.match(/EMU-(?!CLAUSE|XREF|ANNEX|INTRO)|DFN/) &&
        el.id &&
        el.id[0] !== '_'
      ) {
        if (
          el.nodeName === 'EMU-FIGURE' ||
          el.nodeName === 'EMU-TABLE' ||
          el.nodeName === 'EMU-EXAMPLE'
        ) {
          // return the figcaption element
          return { element: el.children[0].children[0], id: el.id };
        } else {
          return { element: el, id: el.id };
        }
      }
      el = parent;
    }
  },

  deactivate() {
    this.$outer.classList.remove('active');
    this._activeEl = null;
    this.active = false;
  },
};

function sortByClauseNumber(clause1, clause2) {
  let c1c = clause1.number.split('.');
  let c2c = clause2.number.split('.');

  for (let i = 0; i < c1c.length; i++) {
    if (i >= c2c.length) {
      return 1;
    }

    let c1 = c1c[i];
    let c2 = c2c[i];
    let c1cn = Number(c1);
    let c2cn = Number(c2);

    if (Number.isNaN(c1cn) && Number.isNaN(c2cn)) {
      if (c1 > c2) {
        return 1;
      } else if (c1 < c2) {
        return -1;
      }
    } else if (!Number.isNaN(c1cn) && Number.isNaN(c2cn)) {
      return -1;
    } else if (Number.isNaN(c1cn) && !Number.isNaN(c2cn)) {
      return 1;
    } else if (c1cn > c2cn) {
      return 1;
    } else if (c1cn < c2cn) {
      return -1;
    }
  }

  if (c1c.length === c2c.length) {
    return 0;
  }
  return -1;
}

function makeLinkToId(id) {
  let hash = '#' + id;
  if (typeof idToSection === 'undefined' || !idToSection[id]) {
    return hash;
  }
  let targetSec = idToSection[id];
  return (targetSec === 'index' ? './' : targetSec + '.html') + hash;
}

function doShortcut(e) {
  if (!(e.target instanceof HTMLElement)) {
    return;
  }
  let target = e.target;
  let name = target.nodeName.toLowerCase();
  if (name === 'textarea' || name === 'input' || name === 'select' || target.isContentEditable) {
    return;
  }
  if (e.key === 'm' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && usesMultipage) {
    let pathParts = location.pathname.split('/');
    let hash = location.hash;
    if (pathParts[pathParts.length - 2] === 'multipage') {
      if (hash === '') {
        let sectionName = pathParts[pathParts.length - 1];
        if (sectionName.endsWith('.html')) {
          sectionName = sectionName.slice(0, -5);
        }
        if (idToSection['sec-' + sectionName] !== undefined) {
          hash = '#sec-' + sectionName;
        }
      }
      location = pathParts.slice(0, -2).join('/') + '/' + hash;
    } else {
      location = 'multipage/' + hash;
    }
  }
}

function init() {
  menu = new Menu();
  let $container = document.getElementById('spec-container');
  $container.addEventListener(
    'mouseover',
    debounce(e => {
      Toolbox.activateIfMouseOver(e);
    })
  );
  document.addEventListener(
    'keydown',
    debounce(e => {
      if (e.code === 'Escape' && Toolbox.active) {
        Toolbox.deactivate();
      }
    })
  );
}

document.addEventListener('keypress', doShortcut);

document.addEventListener('DOMContentLoaded', () => {
  Toolbox.init();
  referencePane.init();
});

'use strict';
let decimalBullet = Array.from({ length: 100 }, (a, i) => '' + (i + 1));
let alphaBullet = Array.from({ length: 26 }, (a, i) => String.fromCharCode('a'.charCodeAt(0) + i));

// prettier-ignore
let romanBullet = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx', 'xxi', 'xxii', 'xxiii', 'xxiv', 'xxv'];
// prettier-ignore
let bullets = [decimalBullet, alphaBullet, romanBullet, decimalBullet, alphaBullet, romanBullet];

function addStepNumberText(ol, parentIndex) {
  for (let i = 0; i < ol.children.length; ++i) {
    let child = ol.children[i];
    let index = parentIndex.concat([i]);
    let applicable = bullets[Math.min(index.length - 1, 5)];
    let span = document.createElement('span');
    span.textContent = (applicable[i] || '?') + '. ';
    span.style.fontSize = '0';
    span.setAttribute('aria-hidden', 'true');
    child.prepend(span);
    let sublist = child.querySelector('ol');
    if (sublist != null) {
      addStepNumberText(sublist, index);
    }
  }
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('emu-alg > ol').forEach(ol => {
    addStepNumberText(ol, []);
  });
});

let sdoMap = JSON.parse(`{}`);
let biblio = JSON.parse(`{"refsByClause":{"sec-intro":["_ref_0"],"conformance":["_ref_1"],"sec-api-conventions":["_ref_2","_ref_169","_ref_170","_ref_171"],"sec-402-well-known-intrinsic-objects":["_ref_3","_ref_4","_ref_5","_ref_6","_ref_7","_ref_8","_ref_9","_ref_10","_ref_11","_ref_172","_ref_173","_ref_174","_ref_175","_ref_176","_ref_177","_ref_178","_ref_179","_ref_180"],"sec-language-tags":["_ref_12"],"sec-defaultlocale":["_ref_13","_ref_14"],"sec-iswellformedcurrencycode":["_ref_15"],"sec-isvalidtimezonename":["_ref_16","_ref_17"],"sec-canonicalizetimezonename":["_ref_18","_ref_19","_ref_185"],"sec-defaulttimezone":["_ref_20","_ref_21"],"sec-issanctionedsimpleunitidentifier":["_ref_22"],"sec-intl.collator-intro":["_ref_23"],"sec-intl.datetimeformat-intro":["_ref_24"],"sec-intl.displaynames-intro":["_ref_25"],"sec-intl.listformat-intro":["_ref_26"],"sec-intl.locale-intro":["_ref_27"],"sec-intl.numberformat-intro":["_ref_28"],"sec-intl.pluralrules-intro":["_ref_29"],"sec-intl.relativetimeformat-intro":["_ref_30"],"locale-and-parameter-negotiation":["_ref_31"],"sec-internal-slots":["_ref_32","_ref_33","_ref_34","_ref_35","_ref_36","_ref_191","_ref_192","_ref_193","_ref_194"],"sec-abstract-operations":["_ref_37"],"sec-the-intl-collator-constructor":["_ref_38","_ref_254"],"sec-intl-collator-internal-slots":["_ref_39","_ref_40"],"sec-intl.collator.prototype.compare":["_ref_41","_ref_280"],"sec-intl.collator.prototype.resolvedoptions":["_ref_42","_ref_285","_ref_286","_ref_287"],"sec-properties-of-intl-collator-instances":["_ref_43","_ref_44","_ref_288"],"sec-initializedatetimeformat":["_ref_45","_ref_46","_ref_47","_ref_289","_ref_290","_ref_291","_ref_292","_ref_293","_ref_294","_ref_295","_ref_296","_ref_297","_ref_298","_ref_299","_ref_300","_ref_301","_ref_302","_ref_303","_ref_304","_ref_305","_ref_306","_ref_307","_ref_308","_ref_309","_ref_310","_ref_311","_ref_312"],"sec-basicformatmatcher":["_ref_48","_ref_321"],"sec-formatdatetimepattern":["_ref_49","_ref_327","_ref_328","_ref_329","_ref_330","_ref_331","_ref_332","_ref_333","_ref_334","_ref_335","_ref_336","_ref_337","_ref_338","_ref_339","_ref_340","_ref_341","_ref_342","_ref_343","_ref_344"],"sec-partitiondatetimerangepattern":["_ref_50","_ref_354","_ref_355","_ref_356","_ref_357","_ref_358","_ref_359","_ref_360","_ref_361"],"sec-tolocaltime":["_ref_51","_ref_52","_ref_370","_ref_371"],"sec-unwrapdatetimeformat":["_ref_53","_ref_372","_ref_373","_ref_374","_ref_375","_ref_376","_ref_377"],"sec-intl-datetimeformat-constructor":["_ref_54","_ref_378"],"sec-intl.datetimeformat":["_ref_55","_ref_379","_ref_380","_ref_381"],"sec-intl.datetimeformat-internal-slots":["_ref_56","_ref_57","_ref_58","_ref_59","_ref_60","_ref_61","_ref_62","_ref_63","_ref_64"],"sec-intl.datetimeformat.prototype.format":["_ref_65","_ref_66","_ref_391","_ref_392"],"sec-intl.datetimeformat.prototype.resolvedoptions":["_ref_67","_ref_68","_ref_69","_ref_405","_ref_406","_ref_407"],"sec-properties-of-intl-datetimeformat-instances":["_ref_70","_ref_71","_ref_72","_ref_73","_ref_408"],"sec-canonicalcodefordisplaynames":["_ref_74","_ref_75","_ref_76","_ref_409","_ref_410","_ref_411"],"sec-intl-displaynames-constructor":["_ref_77","_ref_412"],"sec-Intl.DisplayNames":["_ref_78","_ref_79","_ref_80","_ref_413","_ref_414","_ref_415","_ref_416","_ref_417","_ref_418","_ref_419","_ref_420","_ref_421","_ref_422","_ref_423"],"sec-Intl.DisplayNames-internal-slots":["_ref_81","_ref_82"],"sec-Intl.DisplayNames.prototype.resolvedOptions":["_ref_83","_ref_432","_ref_433"],"sec-properties-of-intl-displaynames-instances":["_ref_84","_ref_434"],"sec-intl-listformat-constructor":["_ref_85","_ref_452"],"sec-Intl.ListFormat-internal-slots":["_ref_86","_ref_87","_ref_467"],"sec-Intl.ListFormat.prototype.resolvedoptions":["_ref_88","_ref_475","_ref_476"],"sec-setnfdigitoptions":["_ref_89","_ref_534","_ref_535","_ref_536","_ref_537","_ref_538","_ref_539","_ref_540","_ref_541","_ref_542"],"sec-partitionnotationsubpattern":["_ref_90","_ref_91","_ref_570","_ref_571","_ref_572"],"sec-unwrapnumberformat":["_ref_92","_ref_580","_ref_581","_ref_582","_ref_583","_ref_584","_ref_585"],"sec-setnumberformatunitoptions":["_ref_93","_ref_586","_ref_587","_ref_588","_ref_589","_ref_590","_ref_591","_ref_592","_ref_593","_ref_594","_ref_595"],"sec-getnumberformatpattern":["_ref_94","_ref_95","_ref_596"],"sec-getnotationsubpattern":["_ref_96","_ref_97","_ref_597"],"sec-intl-numberformat-constructor":["_ref_98","_ref_601"],"sec-intl.numberformat":["_ref_99","_ref_602","_ref_603","_ref_604"],"sec-intl.numberformat-internal-slots":["_ref_100","_ref_101","_ref_102","_ref_103"],"sec-intl.numberformat.prototype.format":["_ref_104","_ref_105","_ref_614","_ref_615"],"sec-intl.numberformat.prototype.resolvedoptions":["_ref_106","_ref_107","_ref_619","_ref_620","_ref_621"],"sec-properties-of-intl-numberformat-instances":["_ref_108","_ref_622"],"sec-intl-pluralrules-constructor":["_ref_109","_ref_642"],"sec-intl.pluralrules-internal-slots":["_ref_110","_ref_111"],"sec-intl.pluralrules.prototype.resolvedoptions":["_ref_112","_ref_113","_ref_653","_ref_654","_ref_655","_ref_656"],"sec-properties-of-intl-pluralrules-instances":["_ref_114","_ref_657"],"sec-intl-relativetimeformat-constructor":["_ref_115","_ref_690"],"sec-Intl.RelativeTimeFormat-internal-slots":["_ref_116","_ref_117","_ref_697"],"sec-intl.relativetimeformat.prototype.resolvedoptions":["_ref_118","_ref_707","_ref_708"],"sup-string.prototype.tolocalelowercase":["_ref_119","_ref_716","_ref_717","_ref_718","_ref_719","_ref_720"],"annex-implementation-dependent-behaviour":["_ref_120","_ref_121","_ref_122","_ref_123","_ref_124","_ref_125","_ref_126","_ref_127","_ref_128","_ref_129","_ref_130","_ref_131","_ref_132","_ref_133","_ref_134","_ref_135","_ref_136","_ref_137","_ref_138","_ref_139","_ref_140","_ref_141","_ref_142","_ref_143","_ref_144","_ref_145","_ref_146","_ref_147","_ref_148","_ref_149","_ref_150","_ref_151","_ref_152","_ref_153","_ref_154","_ref_155","_ref_156","_ref_157","_ref_747","_ref_748","_ref_749"],"annex-incompatibilities":["_ref_158","_ref_159","_ref_160","_ref_161","_ref_162","_ref_163","_ref_164","_ref_165","_ref_166","_ref_167"],"sec-api-overview":["_ref_168"],"sec-canonicalizeunicodelocaleid":["_ref_181","_ref_182","_ref_183","_ref_184"],"sec-iswellformedunitidentifier":["_ref_186","_ref_187","_ref_188"],"sec-intl.getcanonicallocales":["_ref_189","_ref_190"],"sec-canonicalizelocalelist":["_ref_195","_ref_196","_ref_197","_ref_198","_ref_199","_ref_200","_ref_201","_ref_202","_ref_203","_ref_204","_ref_205","_ref_206","_ref_207","_ref_208"],"sec-lookupmatcher":["_ref_209","_ref_210","_ref_211","_ref_212","_ref_213","_ref_214"],"sec-bestfitmatcher":["_ref_215","_ref_216","_ref_217","_ref_218"],"sec-unicode-extension-components":["_ref_219"],"sec-insert-unicode-extension-and-canonicalize":["_ref_220","_ref_221","_ref_222","_ref_223","_ref_224"],"sec-resolvelocale":["_ref_225","_ref_226","_ref_227","_ref_228","_ref_229","_ref_230","_ref_231","_ref_232","_ref_233","_ref_234"],"sec-lookupsupportedlocales":["_ref_235"],"sec-supportedlocales":["_ref_236","_ref_237","_ref_238","_ref_239","_ref_240"],"sec-getoptionsobject":["_ref_241","_ref_242"],"sec-coerceoptionstoobject":["_ref_243","_ref_244","_ref_245"],"sec-getoption":["_ref_246","_ref_247","_ref_248","_ref_249"],"sec-defaultnumberoption":["_ref_250"],"sec-getnumberoption":["_ref_251","_ref_252","_ref_253"],"sec-initializecollator":["_ref_255","_ref_256","_ref_257","_ref_258","_ref_259","_ref_260","_ref_261","_ref_262","_ref_263","_ref_264","_ref_265","_ref_266","_ref_267","_ref_268","_ref_269","_ref_270"],"sec-intl.collator":["_ref_271","_ref_272","_ref_273","_ref_274"],"sec-intl.collator.prototype":["_ref_275"],"sec-intl.collator.supportedlocalesof":["_ref_276","_ref_277","_ref_278"],"sec-intl.collator.prototype.constructor":["_ref_279"],"sec-collator-compare-functions":["_ref_281","_ref_282","_ref_283","_ref_284"],"sec-todatetimeoptions":["_ref_313","_ref_314","_ref_315","_ref_316","_ref_317","_ref_318","_ref_319"],"sec-date-time-style-format":["_ref_320"],"sec-bestfitformatmatcher":["_ref_322"],"sec-datetime-format-functions":["_ref_323","_ref_324","_ref_325","_ref_326"],"sec-partitiondatetimepattern":["_ref_345","_ref_346"],"sec-formatdatetime":["_ref_347"],"sec-formatdatetimetoparts":["_ref_348","_ref_349","_ref_350","_ref_351","_ref_352","_ref_353"],"sec-formatdatetimerange":["_ref_362"],"sec-formatdatetimerangetoparts":["_ref_363","_ref_364","_ref_365","_ref_366","_ref_367","_ref_368","_ref_369"],"sec-chaindatetimeformat":["_ref_382","_ref_383","_ref_384","_ref_385"],"sec-intl.datetimeformat.prototype":["_ref_386"],"sec-intl.datetimeformat.supportedlocalesof":["_ref_387","_ref_388","_ref_389"],"sec-intl.datetimeformat.prototype.constructor":["_ref_390"],"sec-Intl.DateTimeFormat.prototype.formatToParts":["_ref_393","_ref_394","_ref_395","_ref_396"],"sec-intl.datetimeformat.prototype.formatRange":["_ref_397","_ref_398","_ref_399","_ref_400"],"sec-Intl.DateTimeFormat.prototype.formatRangeToParts":["_ref_401","_ref_402","_ref_403","_ref_404"],"sec-Intl.DisplayNames.prototype":["_ref_424"],"sec-Intl.DisplayNames.supportedLocalesOf":["_ref_425","_ref_426","_ref_427"],"sec-Intl.DisplayNames.prototype.constructor":["_ref_428"],"sec-Intl.DisplayNames.prototype.of":["_ref_429","_ref_430","_ref_431"],"sec-deconstructpattern":["_ref_435","_ref_436"],"sec-createpartsfromlist":["_ref_437","_ref_438"],"sec-formatlist":["_ref_439"],"sec-formatlisttoparts":["_ref_440","_ref_441","_ref_442","_ref_443","_ref_444","_ref_445"],"sec-createstringlistfromiterable":["_ref_446","_ref_447","_ref_448","_ref_449","_ref_450","_ref_451"],"sec-Intl.ListFormat":["_ref_453","_ref_454","_ref_455","_ref_456","_ref_457","_ref_458","_ref_459","_ref_460","_ref_461","_ref_462"],"sec-Intl.ListFormat.prototype":["_ref_463"],"sec-Intl.ListFormat.supportedLocalesOf":["_ref_464","_ref_465","_ref_466"],"sec-Intl.ListFormat.prototype.constructor":["_ref_468"],"sec-Intl.ListFormat.prototype.format":["_ref_469","_ref_470","_ref_471"],"sec-Intl.ListFormat.prototype.formatToParts":["_ref_472","_ref_473","_ref_474"],"sec-properties-of-intl-listformat-instances":["_ref_477","_ref_478"],"sec-apply-options-to-tag":["_ref_479","_ref_480","_ref_481","_ref_482","_ref_483","_ref_484","_ref_485","_ref_486"],"sec-apply-unicode-extension-to-tag":["_ref_487","_ref_488","_ref_489","_ref_490","_ref_491","_ref_492"],"sec-Intl.Locale":["_ref_493","_ref_494","_ref_495","_ref_496","_ref_497","_ref_498","_ref_499","_ref_500","_ref_501","_ref_502","_ref_503","_ref_504","_ref_505","_ref_506","_ref_507","_ref_508"],"sec-Intl.Locale.prototype":["_ref_509"],"sec-intl.locale-internal-slots":["_ref_510","_ref_511","_ref_512","_ref_513"],"sec-Intl.Locale.prototype.constructor":["_ref_514"],"sec-Intl.Locale.prototype.maximize":["_ref_515","_ref_516","_ref_517"],"sec-Intl.Locale.prototype.minimize":["_ref_518","_ref_519","_ref_520"],"sec-Intl.Locale.prototype.toString":["_ref_521"],"sec-Intl.Locale.prototype.baseName":["_ref_522"],"sec-Intl.Locale.prototype.calendar":["_ref_523"],"sec-Intl.Locale.prototype.caseFirst":["_ref_524","_ref_525"],"sec-Intl.Locale.prototype.collation":["_ref_526"],"sec-Intl.Locale.prototype.hourCycle":["_ref_527"],"sec-Intl.Locale.prototype.numeric":["_ref_528","_ref_529"],"sec-Intl.Locale.prototype.numberingSystem":["_ref_530"],"sec-Intl.Locale.prototype.language":["_ref_531"],"sec-Intl.Locale.prototype.script":["_ref_532"],"sec-Intl.Locale.prototype.region":["_ref_533"],"sec-initializenumberformat":["_ref_543","_ref_544","_ref_545","_ref_546","_ref_547","_ref_548","_ref_549","_ref_550","_ref_551","_ref_552","_ref_553","_ref_554","_ref_555","_ref_556","_ref_557"],"sec-number-format-functions":["_ref_558","_ref_559","_ref_560"],"sec-formatnumberstring":["_ref_561","_ref_562","_ref_563","_ref_564"],"sec-partitionnumberpattern":["_ref_565","_ref_566","_ref_567","_ref_568","_ref_569"],"sec-formatnumber":["_ref_573"],"sec-formatnumbertoparts":["_ref_574","_ref_575","_ref_576","_ref_577","_ref_578","_ref_579"],"sec-computeexponent":["_ref_598","_ref_599","_ref_600"],"sec-chainnumberformat":["_ref_605","_ref_606","_ref_607","_ref_608"],"sec-intl.numberformat.prototype":["_ref_609"],"sec-intl.numberformat.supportedlocalesof":["_ref_610","_ref_611","_ref_612"],"sec-intl.numberformat.prototype.constructor":["_ref_613"],"sec-intl.numberformat.prototype.formattoparts":["_ref_616","_ref_617","_ref_618"],"sec-initializepluralrules":["_ref_623","_ref_624","_ref_625","_ref_626","_ref_627","_ref_628","_ref_629","_ref_630","_ref_631"],"sec-getoperands":["_ref_632","_ref_633","_ref_634","_ref_635","_ref_636"],"sec-resolveplural":["_ref_637","_ref_638","_ref_639","_ref_640","_ref_641"],"sec-intl.pluralrules":["_ref_643","_ref_644"],"sec-intl.pluralrules.prototype":["_ref_645"],"sec-intl.pluralrules.supportedlocalesof":["_ref_646","_ref_647","_ref_648"],"sec-intl.pluralrules.prototype.constructor":["_ref_649"],"sec-intl.pluralrules.prototype.select":["_ref_650","_ref_651","_ref_652"],"sec-InitializeRelativeTimeFormat":["_ref_658","_ref_659","_ref_660","_ref_661","_ref_662","_ref_663","_ref_664","_ref_665","_ref_666","_ref_667","_ref_668","_ref_669","_ref_670","_ref_671"],"sec-singularrelativetimeunit":["_ref_672"],"sec-PartitionRelativeTimePattern":["_ref_673","_ref_674","_ref_675","_ref_676","_ref_677","_ref_678","_ref_679","_ref_680"],"sec-makepartslist":["_ref_681"],"sec-FormatRelativeTime":["_ref_682"],"sec-FormatRelativeTimeToParts":["_ref_683","_ref_684","_ref_685","_ref_686","_ref_687","_ref_688","_ref_689"],"sec-Intl.RelativeTimeFormat":["_ref_691","_ref_692"],"sec-Intl.RelativeTimeFormat.prototype":["_ref_693"],"sec-Intl.RelativeTimeFormat.supportedLocalesOf":["_ref_694","_ref_695","_ref_696"],"sec-Intl.RelativeTimeFormat.prototype.constructor":["_ref_698"],"sec-Intl.RelativeTimeFormat.prototype.format":["_ref_699","_ref_700","_ref_701","_ref_702"],"sec-Intl.RelativeTimeFormat.prototype.formatToParts":["_ref_703","_ref_704","_ref_705","_ref_706"],"sec-properties-of-intl-relativetimeformat-instances":["_ref_709"],"sup-String.prototype.localeCompare":["_ref_710","_ref_711","_ref_712","_ref_713","_ref_714","_ref_715"],"sup-number.prototype.tolocalestring":["_ref_721","_ref_722","_ref_723"],"sup-bigint.prototype.tolocalestring":["_ref_724","_ref_725","_ref_726"],"sup-date.prototype.tolocalestring":["_ref_727","_ref_728","_ref_729","_ref_730"],"sup-date.prototype.tolocaledatestring":["_ref_731","_ref_732","_ref_733","_ref_734"],"sup-date.prototype.tolocaletimestring":["_ref_735","_ref_736","_ref_737","_ref_738"],"sup-array.prototype.tolocalestring":["_ref_739","_ref_740","_ref_741","_ref_742","_ref_743","_ref_744","_ref_745","_ref_746"]},"entries":[{"type":"clause","id":"introduction","aoid":null,"titleHTML":"Introduction","number":"","referencingIds":[],"key":"Introduction"},{"type":"clause","id":"scope","aoid":null,"titleHTML":"Scope","number":"1","referencingIds":[],"key":"Scope"},{"type":"clause","id":"conformance","aoid":null,"titleHTML":"Conformance","number":"2","referencingIds":["_ref_120"],"key":"Conformance"},{"type":"clause","id":"normative-references","aoid":null,"titleHTML":"Normative References","number":"3","referencingIds":[],"key":"Normative References"},{"type":"clause","id":"sec-internationalization-localization-globalization","aoid":null,"titleHTML":"Internationalization, Localization, and Globalization","number":"4.1","referencingIds":[],"key":"Internationalization, Localization, and Globalization"},{"type":"clause","id":"sec-api-overview","aoid":null,"titleHTML":"API Overview","number":"4.2","referencingIds":[],"key":"API Overview"},{"type":"note","id":"legacy-constructor","node":{},"number":1,"clauseId":"sec-api-conventions","referencingIds":["_ref_53","_ref_55","_ref_65","_ref_67","_ref_92","_ref_99","_ref_104","_ref_106"]},{"type":"clause","id":"sec-api-conventions","aoid":null,"titleHTML":"API Conventions","number":"4.3","referencingIds":[],"key":"API Conventions"},{"type":"clause","id":"sec-compatibility","aoid":null,"titleHTML":"Compatibility across implementations","number":"4.4.1","referencingIds":[],"key":"Compatibility across implementations"},{"type":"clause","id":"sec-implementation-dependencies","aoid":null,"titleHTML":"Implementation Dependencies","number":"4.4","referencingIds":[],"key":"Implementation Dependencies"},{"type":"clause","id":"overview","aoid":null,"titleHTML":"Overview","number":"4","referencingIds":[],"key":"Overview"},{"type":"table","id":"table-402-well-known-intrinsic-objects","node":{},"number":1,"caption":"Table 1: Well-known Intrinsic Objects (Extensions)","referencingIds":[],"key":"Table 1: Well-known Intrinsic Objects (Extensions)"},{"type":"clause","id":"sec-402-well-known-intrinsic-objects","aoid":null,"titleHTML":"Well-Known Intrinsic Objects","number":"5.1","referencingIds":[],"key":"Well-Known Intrinsic Objects"},{"type":"clause","id":"conventions","aoid":null,"titleHTML":"Notational Conventions","number":"5","referencingIds":[],"key":"Notational Conventions"},{"type":"clause","id":"sec-case-sensitivity-and-case-mapping","aoid":null,"titleHTML":"Case Sensitivity and Case Mapping","number":"6.1","referencingIds":["_ref_15","_ref_16","_ref_17","_ref_18","_ref_19","_ref_74","_ref_75","_ref_76","_ref_93"],"key":"Case Sensitivity and Case Mapping"},{"type":"term","term":"Unicode locale extension sequence","refId":"sec-unicode-locale-extension-sequences","referencingIds":[],"key":"Unicode locale extension sequence"},{"type":"clause","id":"sec-unicode-locale-extension-sequences","aoid":null,"titleHTML":"Unicode Locale Extension Sequences","number":"6.2.1","referencingIds":["_ref_119","_ref_182","_ref_184","_ref_192","_ref_211","_ref_213","_ref_214","_ref_217","_ref_218","_ref_219","_ref_220","_ref_221","_ref_222","_ref_488","_ref_489"],"key":"Unicode Locale Extension Sequences"},{"type":"op","aoid":"IsStructurallyValidLanguageTag","refId":"sec-isstructurallyvalidlanguagetag","referencingIds":[],"key":"IsStructurallyValidLanguageTag"},{"type":"clause","id":"sec-isstructurallyvalidlanguagetag","aoid":"IsStructurallyValidLanguageTag","titleHTML":"IsStructurallyValidLanguageTag ( <var>locale</var> )","number":"6.2.2","referencingIds":["_ref_13","_ref_32","_ref_181","_ref_207","_ref_223","_ref_409","_ref_481"],"key":"IsStructurallyValidLanguageTag ( locale )"},{"type":"op","aoid":"CanonicalizeUnicodeLocaleId","refId":"sec-canonicalizeunicodelocaleid","referencingIds":[],"key":"CanonicalizeUnicodeLocaleId"},{"type":"clause","id":"sec-canonicalizeunicodelocaleid","aoid":"CanonicalizeUnicodeLocaleId","titleHTML":"CanonicalizeUnicodeLocaleId ( <var>locale</var> )","number":"6.2.3","referencingIds":["_ref_14","_ref_33","_ref_208","_ref_224","_ref_410","_ref_485","_ref_486"],"key":"CanonicalizeUnicodeLocaleId ( locale )"},{"type":"op","aoid":"DefaultLocale","refId":"sec-defaultlocale","referencingIds":[],"key":"DefaultLocale"},{"type":"clause","id":"sec-defaultlocale","aoid":"DefaultLocale","titleHTML":"DefaultLocale ( )","number":"6.2.4","referencingIds":["_ref_34","_ref_121","_ref_193","_ref_212","_ref_719"],"key":"DefaultLocale ( )"},{"type":"clause","id":"sec-language-tags","aoid":null,"titleHTML":"Language Tags","number":"6.2","referencingIds":[],"key":"Language Tags"},{"type":"op","aoid":"IsWellFormedCurrencyCode","refId":"sec-iswellformedcurrencycode","referencingIds":[],"key":"IsWellFormedCurrencyCode"},{"type":"clause","id":"sec-iswellformedcurrencycode","aoid":"IsWellFormedCurrencyCode","titleHTML":"IsWellFormedCurrencyCode ( <var>currency</var> )","number":"6.3.1","referencingIds":["_ref_411","_ref_590"],"key":"IsWellFormedCurrencyCode ( currency )"},{"type":"clause","id":"sec-currency-codes","aoid":null,"titleHTML":"Currency Codes","number":"6.3","referencingIds":["_ref_102"],"key":"Currency Codes"},{"type":"op","aoid":"IsValidTimeZoneName","refId":"sec-isvalidtimezonename","referencingIds":[],"key":"IsValidTimeZoneName"},{"type":"clause","id":"sec-isvalidtimezonename","aoid":"IsValidTimeZoneName","titleHTML":"IsValidTimeZoneName ( <var>timeZone</var> )","number":"6.4.1","referencingIds":["_ref_20","_ref_185","_ref_303"],"key":"IsValidTimeZoneName ( timeZone )"},{"type":"op","aoid":"CanonicalizeTimeZoneName","refId":"sec-canonicalizetimezonename","referencingIds":[],"key":"CanonicalizeTimeZoneName"},{"type":"clause","id":"sec-canonicalizetimezonename","aoid":"CanonicalizeTimeZoneName","titleHTML":"CanonicalizeTimeZoneName","number":"6.4.2","referencingIds":["_ref_21","_ref_304"],"key":"CanonicalizeTimeZoneName"},{"type":"op","aoid":"DefaultTimeZone","refId":"sec-defaulttimezone","referencingIds":[],"key":"DefaultTimeZone"},{"type":"clause","id":"sec-defaulttimezone","aoid":"DefaultTimeZone","titleHTML":"DefaultTimeZone ( )","number":"6.4.3","referencingIds":["_ref_122","_ref_301"],"key":"DefaultTimeZone ( )"},{"type":"clause","id":"sec-time-zone-names","aoid":null,"titleHTML":"Time Zone Names","number":"6.4","referencingIds":["_ref_139"],"key":"Time Zone Names"},{"type":"op","aoid":"IsWellFormedUnitIdentifier","refId":"sec-iswellformedunitidentifier","referencingIds":[],"key":"IsWellFormedUnitIdentifier"},{"type":"clause","id":"sec-iswellformedunitidentifier","aoid":"IsWellFormedUnitIdentifier","titleHTML":"IsWellFormedUnitIdentifier ( <var>unitIdentifier</var> )","number":"6.5.1","referencingIds":["_ref_594"],"key":"IsWellFormedUnitIdentifier ( unitIdentifier )"},{"type":"table","id":"table-sanctioned-simple-unit-identifiers","node":{},"number":2,"caption":"Table 2: Simple units sanctioned for use in ECMAScript","referencingIds":["_ref_22"],"key":"Table 2: Simple units sanctioned for use in ECMAScript"},{"type":"op","aoid":"IsSanctionedSimpleUnitIdentifier","refId":"sec-issanctionedsimpleunitidentifier","referencingIds":[],"key":"IsSanctionedSimpleUnitIdentifier"},{"type":"clause","id":"sec-issanctionedsimpleunitidentifier","aoid":"IsSanctionedSimpleUnitIdentifier","titleHTML":"IsSanctionedSimpleUnitIdentifier ( <var>unitIdentifier</var> )","number":"6.5.2","referencingIds":["_ref_186","_ref_187","_ref_188"],"key":"IsSanctionedSimpleUnitIdentifier ( unitIdentifier )"},{"type":"clause","id":"sec-measurement-unit-identifiers","aoid":null,"titleHTML":"Measurement Unit Identifiers","number":"6.5","referencingIds":["_ref_103"],"key":"Measurement Unit Identifiers"},{"type":"clause","id":"locales-currencies-tz","aoid":null,"titleHTML":"Identification of Locales, Currencies, Time Zones, and Measurement Units","number":"6","referencingIds":[],"key":"Identification of Locales, Currencies, Time Zones, and Measurement Units"},{"type":"clause","id":"requirements","aoid":null,"titleHTML":"Requirements for Standard Built-in ECMAScript Objects","number":"7","referencingIds":[],"key":"Requirements for Standard Built-in ECMAScript Objects"},{"type":"term","term":"%Intl%","refId":"intl-object","referencingIds":[],"key":"%Intl%"},{"type":"clause","id":"sec-Intl-toStringTag","aoid":null,"titleHTML":"Intl[ @@toStringTag ]","number":"8.1.1","referencingIds":["_ref_166"],"key":"Intl[ @@toStringTag ]"},{"type":"clause","id":"sec-value-properties-of-the-intl-object","aoid":null,"titleHTML":"Value Properties of the Intl Object","number":"8.1","referencingIds":[],"key":"Value Properties of the Intl Object"},{"type":"term","term":"service constructor","refId":"sec-constructor-properties-of-the-intl-object","referencingIds":["_ref_31","_ref_168","_ref_191","_ref_194","_ref_254","_ref_378","_ref_412","_ref_452","_ref_601","_ref_642","_ref_690"],"id":"service-constructor","key":"service constructor"},{"type":"clause","id":"sec-intl.collator-intro","aoid":null,"titleHTML":"Intl.Collator ( . . . )","number":"8.2.1","referencingIds":[],"key":"Intl.Collator ( . . . )"},{"type":"clause","id":"sec-intl.datetimeformat-intro","aoid":null,"titleHTML":"Intl.DateTimeFormat ( . . . )","number":"8.2.2","referencingIds":[],"key":"Intl.DateTimeFormat ( . . . )"},{"type":"clause","id":"sec-intl.displaynames-intro","aoid":null,"titleHTML":"Intl.DisplayNames ( . . . )","number":"8.2.3","referencingIds":[],"key":"Intl.DisplayNames ( . . . )"},{"type":"clause","id":"sec-intl.listformat-intro","aoid":null,"titleHTML":"Intl.ListFormat ( . . . )","number":"8.2.4","referencingIds":[],"key":"Intl.ListFormat ( . . . )"},{"type":"clause","id":"sec-intl.locale-intro","aoid":null,"titleHTML":"Intl.Locale ( . . . )","number":"8.2.5","referencingIds":[],"key":"Intl.Locale ( . . . )"},{"type":"clause","id":"sec-intl.numberformat-intro","aoid":null,"titleHTML":"Intl.NumberFormat ( . . . )","number":"8.2.6","referencingIds":[],"key":"Intl.NumberFormat ( . . . )"},{"type":"clause","id":"sec-intl.pluralrules-intro","aoid":null,"titleHTML":"Intl.PluralRules ( . . . )","number":"8.2.7","referencingIds":[],"key":"Intl.PluralRules ( . . . )"},{"type":"clause","id":"sec-intl.relativetimeformat-intro","aoid":null,"titleHTML":"Intl.RelativeTimeFormat ( . . . )","number":"8.2.8","referencingIds":[],"key":"Intl.RelativeTimeFormat ( . . . )"},{"type":"clause","id":"sec-constructor-properties-of-the-intl-object","aoid":null,"titleHTML":"Constructor Properties of the Intl Object","number":"8.2","referencingIds":["_ref_2","_ref_12"],"key":"Constructor Properties of the Intl Object"},{"type":"clause","id":"sec-intl.getcanonicallocales","aoid":null,"titleHTML":"Intl.getCanonicalLocales ( <var>locales</var> )","number":"8.3.1","referencingIds":[],"key":"Intl.getCanonicalLocales ( locales )"},{"type":"clause","id":"sec-function-properties-of-the-intl-object","aoid":null,"titleHTML":"Function Properties of the Intl Object","number":"8.3","referencingIds":[],"key":"Function Properties of the Intl Object"},{"type":"clause","id":"intl-object","aoid":null,"titleHTML":"The Intl Object","number":"8","referencingIds":["_ref_6","_ref_175","_ref_377","_ref_385","_ref_585","_ref_608"],"key":"The Intl Object"},{"type":"clause","id":"sec-internal-slots","aoid":null,"titleHTML":"Internal slots of Service Constructors","number":"9.1","referencingIds":["_ref_37","_ref_38","_ref_39","_ref_40","_ref_54","_ref_56","_ref_57","_ref_77","_ref_81","_ref_82","_ref_85","_ref_86","_ref_87","_ref_98","_ref_100","_ref_101","_ref_109","_ref_110","_ref_111","_ref_115","_ref_116","_ref_117","_ref_123"],"key":"Internal slots of Service Constructors"},{"type":"op","aoid":"CanonicalizeLocaleList","refId":"sec-canonicalizelocalelist","referencingIds":[],"key":"CanonicalizeLocaleList"},{"type":"clause","id":"sec-canonicalizelocalelist","aoid":"CanonicalizeLocaleList","titleHTML":"CanonicalizeLocaleList ( <var>locales</var> )","number":"9.2.1","referencingIds":["_ref_189","_ref_209","_ref_215","_ref_255","_ref_277","_ref_289","_ref_388","_ref_414","_ref_426","_ref_454","_ref_465","_ref_543","_ref_611","_ref_623","_ref_647","_ref_658","_ref_695","_ref_718"],"key":"CanonicalizeLocaleList ( locales )"},{"type":"op","aoid":"BestAvailableLocale","refId":"sec-bestavailablelocale","referencingIds":[],"key":"BestAvailableLocale"},{"type":"clause","id":"sec-bestavailablelocale","aoid":"BestAvailableLocale","titleHTML":"BestAvailableLocale ( <var>availableLocales</var>, <var>locale</var> )","number":"9.2.2","referencingIds":["_ref_210","_ref_235","_ref_720"],"key":"BestAvailableLocale ( availableLocales, locale )"},{"type":"op","aoid":"LookupMatcher","refId":"sec-lookupmatcher","referencingIds":[],"key":"LookupMatcher"},{"type":"clause","id":"sec-lookupmatcher","aoid":"LookupMatcher","titleHTML":"LookupMatcher ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.3","referencingIds":["_ref_216","_ref_225"],"key":"LookupMatcher ( availableLocales, requestedLocales )"},{"type":"op","aoid":"BestFitMatcher","refId":"sec-bestfitmatcher","referencingIds":[],"key":"BestFitMatcher"},{"type":"clause","id":"sec-bestfitmatcher","aoid":"BestFitMatcher","titleHTML":"BestFitMatcher ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.4","referencingIds":["_ref_124","_ref_226","_ref_747"],"key":"BestFitMatcher ( availableLocales, requestedLocales )"},{"type":"op","aoid":"UnicodeExtensionComponents","refId":"sec-unicode-extension-components","referencingIds":[],"key":"UnicodeExtensionComponents"},{"type":"clause","id":"sec-unicode-extension-components","aoid":"UnicodeExtensionComponents","titleHTML":"UnicodeExtensionComponents ( <var>extension</var> )","number":"9.2.5","referencingIds":["_ref_183","_ref_227","_ref_490"],"key":"UnicodeExtensionComponents ( extension )"},{"type":"op","aoid":"InsertUnicodeExtensionAndCanonicalize","refId":"sec-insert-unicode-extension-and-canonicalize","referencingIds":[],"key":"InsertUnicodeExtensionAndCanonicalize"},{"type":"clause","id":"sec-insert-unicode-extension-and-canonicalize","aoid":"InsertUnicodeExtensionAndCanonicalize","titleHTML":"InsertUnicodeExtensionAndCanonicalize ( <var>locale</var>, <var>extension</var> )","number":"9.2.6","referencingIds":["_ref_234","_ref_492"],"key":"InsertUnicodeExtensionAndCanonicalize ( locale, extension )"},{"type":"op","aoid":"ResolveLocale","refId":"sec-resolvelocale","referencingIds":[],"key":"ResolveLocale"},{"type":"clause","id":"sec-resolvelocale","aoid":"ResolveLocale","titleHTML":"ResolveLocale ( <var>availableLocales</var>, <var>requestedLocales</var>, <var>options</var>, <var>relevantExtensionKeys</var>, <var>localeData</var> )","number":"9.2.7","referencingIds":["_ref_35","_ref_266","_ref_297","_ref_418","_ref_458","_ref_548","_ref_629","_ref_663"],"key":"ResolveLocale ( availableLocales, requestedLocales, options, relevantExtensionKeys, localeData )"},{"type":"op","aoid":"LookupSupportedLocales","refId":"sec-lookupsupportedlocales","referencingIds":[],"key":"LookupSupportedLocales"},{"type":"clause","id":"sec-lookupsupportedlocales","aoid":"LookupSupportedLocales","titleHTML":"LookupSupportedLocales ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.8","referencingIds":["_ref_239"],"key":"LookupSupportedLocales ( availableLocales, requestedLocales )"},{"type":"op","aoid":"BestFitSupportedLocales","refId":"sec-bestfitsupportedlocales","referencingIds":[],"key":"BestFitSupportedLocales"},{"type":"clause","id":"sec-bestfitsupportedlocales","aoid":"BestFitSupportedLocales","titleHTML":"BestFitSupportedLocales ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.9","referencingIds":["_ref_125","_ref_238","_ref_748"],"key":"BestFitSupportedLocales ( availableLocales, requestedLocales )"},{"type":"op","aoid":"SupportedLocales","refId":"sec-supportedlocales","referencingIds":[],"key":"SupportedLocales"},{"type":"clause","id":"sec-supportedlocales","aoid":"SupportedLocales","titleHTML":"SupportedLocales ( <var>availableLocales</var>, <var>requestedLocales</var>, <var>options</var> )","number":"9.2.10","referencingIds":["_ref_278","_ref_389","_ref_427","_ref_466","_ref_612","_ref_648","_ref_696"],"key":"SupportedLocales ( availableLocales, requestedLocales, options )"},{"type":"op","aoid":"GetOptionsObject","refId":"sec-getoptionsobject","referencingIds":[],"key":"GetOptionsObject"},{"type":"clause","id":"sec-getoptionsobject","aoid":"GetOptionsObject","titleHTML":"GetOptionsObject ( <var>options</var> )","number":"9.2.11","referencingIds":["_ref_244","_ref_415","_ref_455"],"key":"GetOptionsObject ( options )"},{"type":"op","aoid":"CoerceOptionsToObject","refId":"sec-coerceoptionstoobject","referencingIds":[],"key":"CoerceOptionsToObject"},{"type":"clause","id":"sec-coerceoptionstoobject","aoid":"CoerceOptionsToObject","titleHTML":"CoerceOptionsToObject ( <var>options</var> )","number":"9.2.12","referencingIds":["_ref_236","_ref_256","_ref_498","_ref_544","_ref_624","_ref_659"],"key":"CoerceOptionsToObject ( options )"},{"type":"op","aoid":"GetOption","refId":"sec-getoption","referencingIds":[],"key":"GetOption"},{"type":"clause","id":"sec-getoption","aoid":"GetOption","titleHTML":"GetOption ( <var>options</var>, <var>property</var>, <var>type</var>, <var>values</var>, <var>fallback</var> )","number":"9.2.13","referencingIds":["_ref_237","_ref_241","_ref_243","_ref_257","_ref_260","_ref_261","_ref_262","_ref_264","_ref_269","_ref_270","_ref_291","_ref_292","_ref_293","_ref_294","_ref_295","_ref_306","_ref_307","_ref_308","_ref_309","_ref_417","_ref_421","_ref_422","_ref_423","_ref_456","_ref_461","_ref_462","_ref_482","_ref_483","_ref_484","_ref_500","_ref_501","_ref_502","_ref_503","_ref_504","_ref_506","_ref_545","_ref_546","_ref_553","_ref_555","_ref_556","_ref_557","_ref_588","_ref_589","_ref_591","_ref_592","_ref_593","_ref_595","_ref_625","_ref_626","_ref_660","_ref_661","_ref_666","_ref_667"],"key":"GetOption ( options, property, type, values, fallback )"},{"type":"op","aoid":"DefaultNumberOption","refId":"sec-defaultnumberoption","referencingIds":[],"key":"DefaultNumberOption"},{"type":"clause","id":"sec-defaultnumberoption","aoid":"DefaultNumberOption","titleHTML":"DefaultNumberOption ( <var>value</var>, <var>minimum</var>, <var>maximum</var>, <var>fallback</var> )","number":"9.2.14","referencingIds":["_ref_253","_ref_539","_ref_540","_ref_541","_ref_542"],"key":"DefaultNumberOption ( value, minimum, maximum, fallback )"},{"type":"op","aoid":"GetNumberOption","refId":"sec-getnumberoption","referencingIds":[],"key":"GetNumberOption"},{"type":"clause","id":"sec-getnumberoption","aoid":"GetNumberOption","titleHTML":"GetNumberOption ( <var>options</var>, <var>property</var>, <var>minimum</var>, <var>maximum</var>, <var>fallback</var> )","number":"9.2.15","referencingIds":["_ref_305","_ref_534"],"key":"GetNumberOption ( options, property, minimum, maximum, fallback )"},{"type":"op","aoid":"PartitionPattern","refId":"sec-partitionpattern","referencingIds":[],"key":"PartitionPattern"},{"type":"clause","id":"sec-partitionpattern","aoid":"PartitionPattern","titleHTML":"PartitionPattern ( <var>pattern</var> )","number":"9.2.16","referencingIds":["_ref_327","_ref_345","_ref_358","_ref_360","_ref_435","_ref_568","_ref_571","_ref_681"],"key":"PartitionPattern ( pattern )"},{"type":"clause","id":"sec-abstract-operations","aoid":null,"titleHTML":"Abstract Operations","number":"9.2","referencingIds":[],"key":"Abstract Operations"},{"type":"clause","id":"locale-and-parameter-negotiation","aoid":null,"titleHTML":"Locale and Parameter Negotiation","number":"9","referencingIds":[],"key":"Locale and Parameter Negotiation"},{"type":"term","term":"%Collator%","refId":"sec-the-intl-collator-constructor","referencingIds":[],"key":"%Collator%"},{"type":"op","aoid":"InitializeCollator","refId":"sec-initializecollator","referencingIds":[],"key":"InitializeCollator"},{"type":"clause","id":"sec-initializecollator","aoid":"InitializeCollator","titleHTML":"InitializeCollator ( <var>collator</var>, <var>locales</var>, <var>options</var> )","number":"10.1.1","referencingIds":["_ref_126","_ref_274"],"key":"InitializeCollator ( collator, locales, options )"},{"type":"clause","id":"sec-intl.collator","aoid":null,"titleHTML":"Intl.Collator ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"10.1.2","referencingIds":[],"key":"Intl.Collator ( [ locales [ , options ] ] )"},{"type":"clause","id":"sec-the-intl-collator-constructor","aoid":null,"titleHTML":"The Intl.Collator Constructor","number":"10.1","referencingIds":["_ref_3","_ref_158","_ref_169","_ref_172","_ref_258","_ref_259","_ref_265","_ref_267","_ref_271","_ref_272","_ref_276","_ref_279","_ref_286","_ref_510","_ref_512","_ref_714"],"key":"The Intl.Collator Constructor"},{"type":"clause","id":"sec-intl.collator.prototype","aoid":null,"titleHTML":"Intl.Collator.prototype","number":"10.2.1","referencingIds":[],"key":"Intl.Collator.prototype"},{"type":"clause","id":"sec-intl.collator.supportedlocalesof","aoid":null,"titleHTML":"Intl.Collator.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"10.2.2","referencingIds":[],"key":"Intl.Collator.supportedLocalesOf ( locales [ , options ] )"},{"type":"clause","id":"sec-intl-collator-internal-slots","aoid":null,"titleHTML":"Internal Slots","number":"10.2.3","referencingIds":["_ref_127","_ref_128","_ref_129","_ref_130"],"key":"Internal Slots"},{"type":"clause","id":"sec-properties-of-the-intl-collator-constructor","aoid":null,"titleHTML":"Properties of the Intl.Collator Constructor","number":"10.2","referencingIds":[],"key":"Properties of the Intl.Collator Constructor"},{"type":"term","term":"%Collator.prototype%","refId":"sec-properties-of-the-intl-collator-prototype-object","referencingIds":[],"key":"%Collator.prototype%"},{"type":"clause","id":"sec-intl.collator.prototype.constructor","aoid":null,"titleHTML":"Intl.Collator.prototype.constructor","number":"10.3.1","referencingIds":[],"key":"Intl.Collator.prototype.constructor"},{"type":"clause","id":"sec-intl.collator.prototype-@@tostringtag","aoid":null,"titleHTML":"Intl.Collator.prototype [ @@toStringTag ]","number":"10.3.2","referencingIds":["_ref_162"],"key":"Intl.Collator.prototype [ @@toStringTag ]"},{"type":"clause","id":"sec-collator-compare-functions","aoid":null,"titleHTML":"Collator Compare Functions","number":"10.3.3.1","referencingIds":["_ref_41","_ref_131"],"key":"Collator Compare Functions"},{"type":"op","aoid":"CompareStrings","refId":"sec-collator-comparestrings","referencingIds":[],"key":"CompareStrings"},{"type":"clause","id":"sec-collator-comparestrings","aoid":"CompareStrings","titleHTML":"CompareStrings ( <var>collator</var>, <var>x</var>, <var>y</var> )","number":"10.3.3.2","referencingIds":["_ref_284","_ref_715"],"key":"CompareStrings ( collator, x, y )"},{"type":"clause","id":"sec-intl.collator.prototype.compare","aoid":null,"titleHTML":"get Intl.Collator.prototype.compare","number":"10.3.3","referencingIds":["_ref_44"],"key":"get Intl.Collator.prototype.compare"},{"type":"table","id":"table-collator-resolvedoptions-properties","node":{},"number":3,"caption":"Table 3: Resolved Options of Collator Instances","referencingIds":["_ref_42","_ref_43"],"key":"Table 3: Resolved Options of Collator Instances"},{"type":"clause","id":"sec-intl.collator.prototype.resolvedoptions","aoid":null,"titleHTML":"Intl.Collator.prototype.resolvedOptions ( )","number":"10.3.4","referencingIds":[],"key":"Intl.Collator.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-the-intl-collator-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.Collator Prototype Object","number":"10.3","referencingIds":["_ref_275","_ref_288"],"key":"Properties of the Intl.Collator Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-collator-instances","aoid":null,"titleHTML":"Properties of Intl.Collator Instances","number":"10.4","referencingIds":[],"key":"Properties of Intl.Collator Instances"},{"type":"clause","id":"collator-objects","aoid":null,"titleHTML":"Collator Objects","number":"10","referencingIds":["_ref_23"],"key":"Collator Objects"},{"type":"table","id":"table-datetimeformat-components","node":{},"number":4,"caption":"Table 4: Components of date and time formats","referencingIds":["_ref_1","_ref_45","_ref_46","_ref_47","_ref_48","_ref_49","_ref_58","_ref_59","_ref_61","_ref_62","_ref_63","_ref_64","_ref_69","_ref_70"],"key":"Table 4: Components of date and time formats"},{"type":"op","aoid":"InitializeDateTimeFormat","refId":"sec-initializedatetimeformat","referencingIds":[],"key":"InitializeDateTimeFormat"},{"type":"clause","id":"sec-initializedatetimeformat","aoid":"InitializeDateTimeFormat","titleHTML":"InitializeDateTimeFormat ( <var>dateTimeFormat</var>, <var>locales</var>, <var>options</var> )","number":"11.1.1","referencingIds":["_ref_132","_ref_380"],"key":"InitializeDateTimeFormat ( dateTimeFormat, locales, options )"},{"type":"op","aoid":"ToDateTimeOptions","refId":"sec-todatetimeoptions","referencingIds":[],"key":"ToDateTimeOptions"},{"type":"clause","id":"sec-todatetimeoptions","aoid":"ToDateTimeOptions","titleHTML":"ToDateTimeOptions ( <var>options</var>, <var>required</var>, <var>defaults</var> )","number":"11.1.2","referencingIds":["_ref_290","_ref_727","_ref_731","_ref_735"],"key":"ToDateTimeOptions ( options, required, defaults )"},{"type":"op","aoid":"DateTimeStyleFormat","refId":"sec-date-time-style-format","referencingIds":[],"key":"DateTimeStyleFormat"},{"type":"clause","id":"sec-date-time-style-format","aoid":"DateTimeStyleFormat","titleHTML":"DateTimeStyleFormat ( <var>dateStyle</var>, <var>timeStyle</var>, <var>styles</var> )","number":"11.1.3","referencingIds":["_ref_310"],"key":"DateTimeStyleFormat ( dateStyle, timeStyle, styles )"},{"type":"op","aoid":"BasicFormatMatcher","refId":"sec-basicformatmatcher","referencingIds":[],"key":"BasicFormatMatcher"},{"type":"clause","id":"sec-basicformatmatcher","aoid":"BasicFormatMatcher","titleHTML":"BasicFormatMatcher ( <var>options</var>, <var>formats</var> )","number":"11.1.4","referencingIds":["_ref_311","_ref_322"],"key":"BasicFormatMatcher ( options, formats )"},{"type":"op","aoid":"BestFitFormatMatcher","refId":"sec-bestfitformatmatcher","referencingIds":[],"key":"BestFitFormatMatcher"},{"type":"clause","id":"sec-bestfitformatmatcher","aoid":"BestFitFormatMatcher","titleHTML":"BestFitFormatMatcher ( <var>options</var>, <var>formats</var> )","number":"11.1.5","referencingIds":["_ref_312","_ref_749"],"key":"BestFitFormatMatcher ( options, formats )"},{"type":"clause","id":"sec-datetime-format-functions","aoid":null,"titleHTML":"DateTime Format Functions","number":"11.1.6","referencingIds":["_ref_66"],"key":"DateTime Format Functions"},{"type":"op","aoid":"FormatDateTimePattern","refId":"sec-formatdatetimepattern","referencingIds":[],"key":"FormatDateTimePattern"},{"type":"clause","id":"sec-formatdatetimepattern","aoid":"FormatDateTimePattern","titleHTML":"FormatDateTimePattern ( <var>dateTimeFormat</var>, <var>patternParts</var>, <var>x</var>, <var>rangeFormatOptions</var> )","number":"11.1.7","referencingIds":["_ref_346","_ref_359","_ref_361"],"key":"FormatDateTimePattern ( dateTimeFormat, patternParts, x, rangeFormatOptions )"},{"type":"op","aoid":"PartitionDateTimePattern","refId":"sec-partitiondatetimepattern","referencingIds":[],"key":"PartitionDateTimePattern"},{"type":"clause","id":"sec-partitiondatetimepattern","aoid":"PartitionDateTimePattern","titleHTML":"PartitionDateTimePattern ( <var>dateTimeFormat</var>, <var>x</var> )","number":"11.1.8","referencingIds":["_ref_347","_ref_348"],"key":"PartitionDateTimePattern ( dateTimeFormat, x )"},{"type":"op","aoid":"FormatDateTime","refId":"sec-formatdatetime","referencingIds":[],"key":"FormatDateTime"},{"type":"clause","id":"sec-formatdatetime","aoid":"FormatDateTime","titleHTML":"FormatDateTime ( <var>dateTimeFormat</var>, <var>x</var> )","number":"11.1.9","referencingIds":["_ref_137","_ref_138","_ref_326","_ref_730","_ref_734","_ref_738"],"key":"FormatDateTime ( dateTimeFormat, x )"},{"type":"op","aoid":"FormatDateTimeToParts","refId":"sec-formatdatetimetoparts","referencingIds":[],"key":"FormatDateTimeToParts"},{"type":"clause","id":"sec-formatdatetimetoparts","aoid":"FormatDateTimeToParts","titleHTML":"FormatDateTimeToParts ( <var>dateTimeFormat</var>, <var>x</var> )","number":"11.1.10","referencingIds":["_ref_396"],"key":"FormatDateTimeToParts ( dateTimeFormat, x )"},{"type":"op","aoid":"PartitionDateTimeRangePattern","refId":"sec-partitiondatetimerangepattern","referencingIds":[],"key":"PartitionDateTimeRangePattern"},{"type":"clause","id":"sec-partitiondatetimerangepattern","aoid":"PartitionDateTimeRangePattern","titleHTML":"PartitionDateTimeRangePattern ( <var>dateTimeFormat</var>, <var>x</var>, <var>y</var> )","number":"11.1.11","referencingIds":["_ref_362","_ref_363"],"key":"PartitionDateTimeRangePattern ( dateTimeFormat, x, y )"},{"type":"op","aoid":"FormatDateTimeRange","refId":"sec-formatdatetimerange","referencingIds":[],"key":"FormatDateTimeRange"},{"type":"clause","id":"sec-formatdatetimerange","aoid":"FormatDateTimeRange","titleHTML":"FormatDateTimeRange ( <var>dateTimeFormat</var>, <var>x</var>, <var>y</var> )","number":"11.1.12","referencingIds":["_ref_400"],"key":"FormatDateTimeRange ( dateTimeFormat, x, y )"},{"type":"op","aoid":"FormatDateTimeRangeToParts","refId":"sec-formatdatetimerangetoparts","referencingIds":[],"key":"FormatDateTimeRangeToParts"},{"type":"clause","id":"sec-formatdatetimerangetoparts","aoid":"FormatDateTimeRangeToParts","titleHTML":"FormatDateTimeRangeToParts ( <var>dateTimeFormat</var>, <var>x</var>, <var>y</var> )","number":"11.1.13","referencingIds":["_ref_404"],"key":"FormatDateTimeRangeToParts ( dateTimeFormat, x, y )"},{"type":"table","id":"table-datetimeformat-tolocaltime-record","node":{},"number":5,"caption":"Table 5: Record returned by ToLocalTime","referencingIds":["_ref_51","_ref_52"],"key":"Table 5: Record returned by ToLocalTime"},{"type":"op","aoid":"ToLocalTime","refId":"sec-tolocaltime","referencingIds":[],"key":"ToLocalTime"},{"type":"clause","id":"sec-tolocaltime","aoid":"ToLocalTime","titleHTML":"ToLocalTime ( <var>t</var>, <var>calendar</var>, <var>timeZone</var> )","number":"11.1.14","referencingIds":["_ref_340","_ref_356","_ref_357","_ref_371"],"key":"ToLocalTime ( t, calendar, timeZone )"},{"type":"op","aoid":"UnwrapDateTimeFormat","refId":"sec-unwrapdatetimeformat","referencingIds":[],"key":"UnwrapDateTimeFormat"},{"type":"clause","id":"sec-unwrapdatetimeformat","aoid":"UnwrapDateTimeFormat","titleHTML":"UnwrapDateTimeFormat ( <var>dtf</var> )","number":"11.1.15","referencingIds":["_ref_391","_ref_405"],"key":"UnwrapDateTimeFormat ( dtf )"},{"type":"clause","id":"sec-datetimeformat-abstracts","aoid":null,"titleHTML":"Abstract Operations for DateTimeFormat Objects","number":"11.1","referencingIds":[],"key":"Abstract Operations for DateTimeFormat Objects"},{"type":"term","term":"%DateTimeFormat%","refId":"sec-intl-datetimeformat-constructor","referencingIds":[],"key":"%DateTimeFormat%"},{"type":"op","aoid":"ChainDateTimeFormat","refId":"sec-chaindatetimeformat","referencingIds":[],"key":"ChainDateTimeFormat"},{"type":"clause","id":"sec-chaindatetimeformat","aoid":"ChainDateTimeFormat","titleHTML":"ChainDateTimeFormat ( <var>dateTimeFormat</var>, <var>newTarget</var>, <var>this</var> )","number":"11.2.1.1","referencingIds":["_ref_381"],"key":"ChainDateTimeFormat ( dateTimeFormat, newTarget, this )"},{"type":"clause","id":"sec-intl.datetimeformat","aoid":null,"titleHTML":"Intl.DateTimeFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"11.2.1","referencingIds":[],"key":"Intl.DateTimeFormat ( [ locales [ , options ] ] )"},{"type":"clause","id":"sec-intl-datetimeformat-constructor","aoid":null,"titleHTML":"The Intl.DateTimeFormat Constructor","number":"11.2","referencingIds":["_ref_4","_ref_160","_ref_170","_ref_173","_ref_296","_ref_298","_ref_299","_ref_320","_ref_372","_ref_375","_ref_383","_ref_387","_ref_390","_ref_729","_ref_733","_ref_737"],"key":"The Intl.DateTimeFormat Constructor"},{"type":"clause","id":"sec-intl.datetimeformat.prototype","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype","number":"11.3.1","referencingIds":[],"key":"Intl.DateTimeFormat.prototype"},{"type":"clause","id":"sec-intl.datetimeformat.supportedlocalesof","aoid":null,"titleHTML":"Intl.DateTimeFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"11.3.2","referencingIds":[],"key":"Intl.DateTimeFormat.supportedLocalesOf ( locales [ , options ] )"},{"type":"table","id":"table-datetimeformat-rangepatternfields","node":{},"number":6,"caption":"Table 6: Range pattern fields","referencingIds":["_ref_50","_ref_60"],"key":"Table 6: Range pattern fields"},{"type":"clause","id":"sec-intl.datetimeformat-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"11.3.3","referencingIds":["_ref_36","_ref_71","_ref_72","_ref_133","_ref_134","_ref_135","_ref_136"],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-datetimeformat-constructor","aoid":null,"titleHTML":"Properties of the Intl.DateTimeFormat Constructor","number":"11.3","referencingIds":[],"key":"Properties of the Intl.DateTimeFormat Constructor"},{"type":"term","term":"%DateTimeFormat.prototype%","refId":"sec-properties-of-intl-datetimeformat-prototype-object","referencingIds":[],"key":"%DateTimeFormat.prototype%"},{"type":"clause","id":"sec-intl.datetimeformat.prototype.constructor","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype.constructor","number":"11.4.1","referencingIds":[],"key":"Intl.DateTimeFormat.prototype.constructor"},{"type":"clause","id":"sec-intl.datetimeformat.prototype-@@tostringtag","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype [ @@toStringTag ]","number":"11.4.2","referencingIds":["_ref_163"],"key":"Intl.DateTimeFormat.prototype [ @@toStringTag ]"},{"type":"clause","id":"sec-intl.datetimeformat.prototype.format","aoid":null,"titleHTML":"get Intl.DateTimeFormat.prototype.format","number":"11.4.3","referencingIds":["_ref_73","_ref_161"],"key":"get Intl.DateTimeFormat.prototype.format"},{"type":"clause","id":"sec-Intl.DateTimeFormat.prototype.formatToParts","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype.formatToParts ( <var>date</var> )","number":"11.4.4","referencingIds":[],"key":"Intl.DateTimeFormat.prototype.formatToParts ( date )"},{"type":"clause","id":"sec-intl.datetimeformat.prototype.formatRange","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype.formatRange ( <var>startDate</var>, <var>endDate</var> )","number":"11.4.5","referencingIds":[],"key":"Intl.DateTimeFormat.prototype.formatRange ( startDate, endDate )"},{"type":"clause","id":"sec-Intl.DateTimeFormat.prototype.formatRangeToParts","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype.formatRangeToParts ( <var>startDate</var>, <var>endDate</var> )","number":"11.4.6","referencingIds":[],"key":"Intl.DateTimeFormat.prototype.formatRangeToParts ( startDate, endDate )"},{"type":"table","id":"table-datetimeformat-resolvedoptions-properties","node":{},"number":7,"caption":"Table 7: Resolved Options of DateTimeFormat Instances","referencingIds":["_ref_68"],"key":"Table 7: Resolved Options of DateTimeFormat Instances"},{"type":"clause","id":"sec-intl.datetimeformat.prototype.resolvedoptions","aoid":null,"titleHTML":"Intl.DateTimeFormat.prototype.resolvedOptions ( )","number":"11.4.7","referencingIds":[],"key":"Intl.DateTimeFormat.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-intl-datetimeformat-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.DateTimeFormat Prototype Object","number":"11.4","referencingIds":["_ref_386","_ref_408"],"key":"Properties of the Intl.DateTimeFormat Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-datetimeformat-instances","aoid":null,"titleHTML":"Properties of Intl.DateTimeFormat Instances","number":"11.5","referencingIds":[],"key":"Properties of Intl.DateTimeFormat Instances"},{"type":"clause","id":"datetimeformat-objects","aoid":null,"titleHTML":"DateTimeFormat Objects","number":"11","referencingIds":["_ref_24"],"key":"DateTimeFormat Objects"},{"type":"op","aoid":"CanonicalCodeForDisplayNames","refId":"sec-canonicalcodefordisplaynames","referencingIds":[],"key":"CanonicalCodeForDisplayNames"},{"type":"clause","id":"sec-canonicalcodefordisplaynames","aoid":"CanonicalCodeForDisplayNames","titleHTML":"CanonicalCodeForDisplayNames ( <var>type</var>, <var>code</var> )","number":"12.1.1","referencingIds":["_ref_431"],"key":"CanonicalCodeForDisplayNames ( type, code )"},{"type":"clause","id":"sec-intl-displaynames-abstracts","aoid":null,"titleHTML":"Abstract Operations for DisplayNames Objects","number":"12.1","referencingIds":[],"key":"Abstract Operations for DisplayNames Objects"},{"type":"term","term":"%DisplayNames%","refId":"sec-intl-displaynames-constructor","referencingIds":[],"key":"%DisplayNames%"},{"type":"clause","id":"sec-Intl.DisplayNames","aoid":null,"titleHTML":"Intl.DisplayNames ( <var>locales</var>, <var>options</var> )","number":"12.2.1","referencingIds":[],"key":"Intl.DisplayNames ( locales, options )"},{"type":"clause","id":"sec-intl-displaynames-constructor","aoid":null,"titleHTML":"The Intl.DisplayNames Constructor","number":"12.2","referencingIds":["_ref_5","_ref_174","_ref_416","_ref_419","_ref_420","_ref_425","_ref_428"],"key":"The Intl.DisplayNames Constructor"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype","aoid":null,"titleHTML":"Intl.DisplayNames.prototype","number":"12.3.1","referencingIds":[],"key":"Intl.DisplayNames.prototype"},{"type":"clause","id":"sec-Intl.DisplayNames.supportedLocalesOf","aoid":null,"titleHTML":"Intl.DisplayNames.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"12.3.2","referencingIds":[],"key":"Intl.DisplayNames.supportedLocalesOf ( locales [ , options ] )"},{"type":"clause","id":"sec-Intl.DisplayNames-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"12.3.3","referencingIds":["_ref_78","_ref_79","_ref_80","_ref_84","_ref_140"],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-displaynames-constructor","aoid":null,"titleHTML":"Properties of the Intl.DisplayNames Constructor","number":"12.3","referencingIds":[],"key":"Properties of the Intl.DisplayNames Constructor"},{"type":"term","term":"%DisplayNames.prototype%","refId":"sec-properties-of-intl-displaynames-prototype-object","referencingIds":[],"key":"%DisplayNames.prototype%"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype.constructor","aoid":null,"titleHTML":"Intl.DisplayNames.prototype.constructor","number":"12.4.1","referencingIds":[],"key":"Intl.DisplayNames.prototype.constructor"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype-@@tostringtag","aoid":null,"titleHTML":"Intl.DisplayNames.prototype[ @@toStringTag ]","number":"12.4.2","referencingIds":[],"key":"Intl.DisplayNames.prototype[ @@toStringTag ]"},{"type":"op","aoid":"Intl.DisplayNames.prototype.of","refId":"sec-Intl.DisplayNames.prototype.of","referencingIds":[],"key":"Intl.DisplayNames.prototype.of"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype.of","aoid":"Intl.DisplayNames.prototype.of","titleHTML":"Intl.DisplayNames.prototype.of ( <var>code</var> )","number":"12.4.3","referencingIds":[],"key":"Intl.DisplayNames.prototype.of ( code )"},{"type":"table","id":"table-displaynames-resolvedoptions-properties","node":{},"number":8,"caption":"Table 8: Resolved Options of DisplayNames Instances","referencingIds":["_ref_83"],"key":"Table 8: Resolved Options of DisplayNames Instances"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype.resolvedOptions","aoid":null,"titleHTML":"Intl.DisplayNames.prototype.resolvedOptions ( )","number":"12.4.4","referencingIds":[],"key":"Intl.DisplayNames.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-intl-displaynames-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.DisplayNames Prototype Object","number":"12.4","referencingIds":["_ref_424","_ref_434"],"key":"Properties of the Intl.DisplayNames Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-displaynames-instances","aoid":null,"titleHTML":"Properties of Intl.DisplayNames Instances","number":"12.5","referencingIds":[],"key":"Properties of Intl.DisplayNames Instances"},{"type":"clause","id":"intl-displaynames-objects","aoid":null,"titleHTML":"DisplayNames Objects","number":"12","referencingIds":["_ref_25"],"key":"DisplayNames Objects"},{"type":"op","aoid":"DeconstructPattern","refId":"sec-deconstructpattern","referencingIds":[],"key":"DeconstructPattern"},{"type":"clause","id":"sec-deconstructpattern","aoid":"DeconstructPattern","titleHTML":"DeconstructPattern ( <var>pattern</var>, <var>placeables</var> )","number":"13.1.1","referencingIds":["_ref_437","_ref_438"],"key":"DeconstructPattern ( pattern, placeables )"},{"type":"op","aoid":"CreatePartsFromList","refId":"sec-createpartsfromlist","referencingIds":[],"key":"CreatePartsFromList"},{"type":"clause","id":"sec-createpartsfromlist","aoid":"CreatePartsFromList","titleHTML":"CreatePartsFromList ( <var>listFormat</var>, <var>list</var> )","number":"13.1.2","referencingIds":["_ref_439","_ref_440"],"key":"CreatePartsFromList ( listFormat, list )"},{"type":"op","aoid":"FormatList","refId":"sec-formatlist","referencingIds":[],"key":"FormatList"},{"type":"clause","id":"sec-formatlist","aoid":"FormatList","titleHTML":"FormatList ( <var>listFormat</var>, <var>list</var> )","number":"13.1.3","referencingIds":["_ref_471"],"key":"FormatList ( listFormat, list )"},{"type":"op","aoid":"FormatListToParts","refId":"sec-formatlisttoparts","referencingIds":[],"key":"FormatListToParts"},{"type":"clause","id":"sec-formatlisttoparts","aoid":"FormatListToParts","titleHTML":"FormatListToParts ( <var>listFormat</var>, <var>list</var> )","number":"13.1.4","referencingIds":["_ref_474"],"key":"FormatListToParts ( listFormat, list )"},{"type":"op","aoid":"StringListFromIterable","refId":"sec-createstringlistfromiterable","referencingIds":[],"key":"StringListFromIterable"},{"type":"clause","id":"sec-createstringlistfromiterable","aoid":"StringListFromIterable","titleHTML":"StringListFromIterable ( <var>iterable</var> )","number":"13.1.5","referencingIds":["_ref_470","_ref_473"],"key":"StringListFromIterable ( iterable )"},{"type":"clause","id":"sec-intl-listformat-abstracts","aoid":null,"titleHTML":"Abstract Operations for ListFormat Objects","number":"13.1","referencingIds":[],"key":"Abstract Operations for ListFormat Objects"},{"type":"term","term":"%ListFormat%","refId":"sec-intl-listformat-constructor","referencingIds":[],"key":"%ListFormat%"},{"type":"clause","id":"sec-Intl.ListFormat","aoid":null,"titleHTML":"Intl.ListFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"13.2.1","referencingIds":[],"key":"Intl.ListFormat ( [ locales [ , options ] ] )"},{"type":"clause","id":"sec-intl-listformat-constructor","aoid":null,"titleHTML":"The Intl.ListFormat Constructor","number":"13.2","referencingIds":["_ref_7","_ref_176","_ref_457","_ref_459","_ref_460","_ref_464","_ref_467","_ref_468"],"key":"The Intl.ListFormat Constructor"},{"type":"clause","id":"sec-Intl.ListFormat.prototype","aoid":null,"titleHTML":"Intl.ListFormat.prototype","number":"13.3.1","referencingIds":[],"key":"Intl.ListFormat.prototype"},{"type":"clause","id":"sec-Intl.ListFormat.supportedLocalesOf","aoid":null,"titleHTML":"Intl.ListFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"13.3.2","referencingIds":[],"key":"Intl.ListFormat.supportedLocalesOf ( locales [ , options ] )"},{"type":"term","term":"ListFormat template set","refId":"sec-Intl.ListFormat-internal-slots","referencingIds":[],"key":"ListFormat template set"},{"type":"clause","id":"sec-Intl.ListFormat-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"13.3.3","referencingIds":["_ref_141","_ref_478"],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-listformat-constructor","aoid":null,"titleHTML":"Properties of the Intl.ListFormat Constructor","number":"13.3","referencingIds":[],"key":"Properties of the Intl.ListFormat Constructor"},{"type":"term","term":"%ListFormat.prototype%","refId":"sec-properties-of-intl-listformat-prototype-object","referencingIds":[],"key":"%ListFormat.prototype%"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.constructor","aoid":null,"titleHTML":"Intl.ListFormat.prototype.constructor","number":"13.4.1","referencingIds":[],"key":"Intl.ListFormat.prototype.constructor"},{"type":"clause","id":"sec-Intl.ListFormat.prototype-toStringTag","aoid":null,"titleHTML":"Intl.ListFormat.prototype [ @@toStringTag ]","number":"13.4.2","referencingIds":[],"key":"Intl.ListFormat.prototype [ @@toStringTag ]"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.format","aoid":null,"titleHTML":"Intl.ListFormat.prototype.format ( <var>list</var> )","number":"13.4.3","referencingIds":[],"key":"Intl.ListFormat.prototype.format ( list )"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.formatToParts","aoid":null,"titleHTML":"Intl.ListFormat.prototype.formatToParts ( <var>list</var> )","number":"13.4.4","referencingIds":[],"key":"Intl.ListFormat.prototype.formatToParts ( list )"},{"type":"table","id":"table-listformat-resolvedoptions-properties","node":{},"number":9,"caption":"Table 9: Resolved Options of ListFormat Instances","referencingIds":["_ref_88"],"key":"Table 9: Resolved Options of ListFormat Instances"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.resolvedoptions","aoid":null,"titleHTML":"Intl.ListFormat.prototype.resolvedOptions ( )","number":"13.4.5","referencingIds":[],"key":"Intl.ListFormat.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-intl-listformat-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.ListFormat Prototype Object","number":"13.4","referencingIds":["_ref_463","_ref_477"],"key":"Properties of the Intl.ListFormat Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-listformat-instances","aoid":null,"titleHTML":"Properties of Intl.ListFormat Instances","number":"13.5","referencingIds":[],"key":"Properties of Intl.ListFormat Instances"},{"type":"clause","id":"listformat-objects","aoid":null,"titleHTML":"ListFormat Objects","number":"13","referencingIds":["_ref_26"],"key":"ListFormat Objects"},{"type":"term","term":"%Locale%","refId":"sec-intl-locale-constructor","referencingIds":[],"key":"%Locale%"},{"type":"op","aoid":"ApplyOptionsToTag","refId":"sec-apply-options-to-tag","referencingIds":[],"key":"ApplyOptionsToTag"},{"type":"clause","id":"sec-apply-options-to-tag","aoid":"ApplyOptionsToTag","titleHTML":"ApplyOptionsToTag ( <var>tag</var>, <var>options</var> )","number":"14.1.1","referencingIds":["_ref_499"],"key":"ApplyOptionsToTag ( tag, options )"},{"type":"op","aoid":"ApplyUnicodeExtensionToTag","refId":"sec-apply-unicode-extension-to-tag","referencingIds":[],"key":"ApplyUnicodeExtensionToTag"},{"type":"clause","id":"sec-apply-unicode-extension-to-tag","aoid":"ApplyUnicodeExtensionToTag","titleHTML":"ApplyUnicodeExtensionToTag ( <var>tag</var>, <var>options</var>, <var>relevantExtensionKeys</var> )","number":"14.1.2","referencingIds":["_ref_507"],"key":"ApplyUnicodeExtensionToTag ( tag, options, relevantExtensionKeys )"},{"type":"clause","id":"sec-Intl.Locale","aoid":null,"titleHTML":"Intl.Locale ( <var>tag</var> [ , <var>options</var> ] )","number":"14.1.3","referencingIds":["_ref_142"],"key":"Intl.Locale ( tag [ , options ] )"},{"type":"clause","id":"sec-intl-locale-constructor","aoid":null,"titleHTML":"The Intl.Locale Constructor","number":"14.1","referencingIds":["_ref_8","_ref_177","_ref_493","_ref_511","_ref_513","_ref_514","_ref_517","_ref_520","_ref_524","_ref_528"],"key":"The Intl.Locale Constructor"},{"type":"clause","id":"sec-Intl.Locale.prototype","aoid":null,"titleHTML":"Intl.Locale.prototype","number":"14.2.1","referencingIds":[],"key":"Intl.Locale.prototype"},{"type":"clause","id":"sec-intl.locale-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"14.2.2","referencingIds":[],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-locale-constructor","aoid":null,"titleHTML":"Properties of the Intl.Locale Constructor","number":"14.2","referencingIds":[],"key":"Properties of the Intl.Locale Constructor"},{"type":"term","term":"%Locale.prototype%","refId":"sec-properties-of-intl-locale-prototype-object","referencingIds":[],"key":"%Locale.prototype%"},{"type":"clause","id":"sec-Intl.Locale.prototype.constructor","aoid":null,"titleHTML":"Intl.Locale.prototype.constructor","number":"14.3.1","referencingIds":[],"key":"Intl.Locale.prototype.constructor"},{"type":"clause","id":"sec-Intl.Locale.prototype-@@tostringtag","aoid":null,"titleHTML":"Intl.Locale.prototype[ @@toStringTag ]","number":"14.3.2","referencingIds":[],"key":"Intl.Locale.prototype[ @@toStringTag ]"},{"type":"clause","id":"sec-Intl.Locale.prototype.maximize","aoid":null,"titleHTML":"Intl.Locale.prototype.maximize ( )","number":"14.3.3","referencingIds":[],"key":"Intl.Locale.prototype.maximize ( )"},{"type":"clause","id":"sec-Intl.Locale.prototype.minimize","aoid":null,"titleHTML":"Intl.Locale.prototype.minimize ( )","number":"14.3.4","referencingIds":[],"key":"Intl.Locale.prototype.minimize ( )"},{"type":"clause","id":"sec-Intl.Locale.prototype.toString","aoid":null,"titleHTML":"Intl.Locale.prototype.toString ( )","number":"14.3.5","referencingIds":[],"key":"Intl.Locale.prototype.toString ( )"},{"type":"clause","id":"sec-Intl.Locale.prototype.baseName","aoid":null,"titleHTML":"get Intl.Locale.prototype.baseName","number":"14.3.6","referencingIds":[],"key":"get Intl.Locale.prototype.baseName"},{"type":"clause","id":"sec-Intl.Locale.prototype.calendar","aoid":null,"titleHTML":"get Intl.Locale.prototype.calendar","number":"14.3.7","referencingIds":[],"key":"get Intl.Locale.prototype.calendar"},{"type":"clause","id":"sec-Intl.Locale.prototype.caseFirst","aoid":null,"titleHTML":"get Intl.Locale.prototype.caseFirst","number":"14.3.8","referencingIds":[],"key":"get Intl.Locale.prototype.caseFirst"},{"type":"clause","id":"sec-Intl.Locale.prototype.collation","aoid":null,"titleHTML":"get Intl.Locale.prototype.collation","number":"14.3.9","referencingIds":[],"key":"get Intl.Locale.prototype.collation"},{"type":"clause","id":"sec-Intl.Locale.prototype.hourCycle","aoid":null,"titleHTML":"get Intl.Locale.prototype.hourCycle","number":"14.3.10","referencingIds":[],"key":"get Intl.Locale.prototype.hourCycle"},{"type":"clause","id":"sec-Intl.Locale.prototype.numeric","aoid":null,"titleHTML":"get Intl.Locale.prototype.numeric","number":"14.3.11","referencingIds":[],"key":"get Intl.Locale.prototype.numeric"},{"type":"clause","id":"sec-Intl.Locale.prototype.numberingSystem","aoid":null,"titleHTML":"get Intl.Locale.prototype.numberingSystem","number":"14.3.12","referencingIds":[],"key":"get Intl.Locale.prototype.numberingSystem"},{"type":"clause","id":"sec-Intl.Locale.prototype.language","aoid":null,"titleHTML":"get Intl.Locale.prototype.language","number":"14.3.13","referencingIds":[],"key":"get Intl.Locale.prototype.language"},{"type":"clause","id":"sec-Intl.Locale.prototype.script","aoid":null,"titleHTML":"get Intl.Locale.prototype.script","number":"14.3.14","referencingIds":[],"key":"get Intl.Locale.prototype.script"},{"type":"clause","id":"sec-Intl.Locale.prototype.region","aoid":null,"titleHTML":"get Intl.Locale.prototype.region","number":"14.3.15","referencingIds":[],"key":"get Intl.Locale.prototype.region"},{"type":"clause","id":"sec-properties-of-intl-locale-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.Locale Prototype Object","number":"14.3","referencingIds":["_ref_509"],"key":"Properties of the Intl.Locale Prototype Object"},{"type":"clause","id":"locale-objects","aoid":null,"titleHTML":"Locale Objects","number":"14","referencingIds":["_ref_27"],"key":"Locale Objects"},{"type":"op","aoid":"SetNumberFormatDigitOptions","refId":"sec-setnfdigitoptions","referencingIds":[],"key":"SetNumberFormatDigitOptions"},{"type":"clause","id":"sec-setnfdigitoptions","aoid":"SetNumberFormatDigitOptions","titleHTML":"SetNumberFormatDigitOptions ( <var>intlObj</var>, <var>options</var>, <var>mnfdDefault</var>, <var>mxfdDefault</var>, <var>notation</var> )","number":"15.1.1","referencingIds":["_ref_554","_ref_627"],"key":"SetNumberFormatDigitOptions ( intlObj, options, mnfdDefault, mxfdDefault, notation )"},{"type":"op","aoid":"InitializeNumberFormat","refId":"sec-initializenumberformat","referencingIds":[],"key":"InitializeNumberFormat"},{"type":"clause","id":"sec-initializenumberformat","aoid":"InitializeNumberFormat","titleHTML":"InitializeNumberFormat ( <var>numberFormat</var>, <var>locales</var>, <var>options</var> )","number":"15.1.2","referencingIds":["_ref_603"],"key":"InitializeNumberFormat ( numberFormat, locales, options )"},{"type":"op","aoid":"CurrencyDigits","refId":"sec-currencydigits","referencingIds":[],"key":"CurrencyDigits"},{"type":"clause","id":"sec-currencydigits","aoid":"CurrencyDigits","titleHTML":"CurrencyDigits ( <var>currency</var> )","number":"15.1.3","referencingIds":["_ref_552"],"key":"CurrencyDigits ( currency )"},{"type":"clause","id":"sec-number-format-functions","aoid":null,"titleHTML":"Number Format Functions","number":"15.1.4","referencingIds":["_ref_105"],"key":"Number Format Functions"},{"type":"op","aoid":"FormatNumericToString","refId":"sec-formatnumberstring","referencingIds":[],"key":"FormatNumericToString"},{"type":"clause","id":"sec-formatnumberstring","aoid":"FormatNumericToString","titleHTML":"FormatNumericToString ( <var>intlObject</var>, <var>x</var> )","number":"15.1.5","referencingIds":["_ref_89","_ref_566","_ref_599","_ref_639"],"key":"FormatNumericToString ( intlObject, x )"},{"type":"op","aoid":"PartitionNumberPattern","refId":"sec-partitionnumberpattern","referencingIds":[],"key":"PartitionNumberPattern"},{"type":"clause","id":"sec-partitionnumberpattern","aoid":"PartitionNumberPattern","titleHTML":"PartitionNumberPattern ( <var>numberFormat</var>, <var>x</var> )","number":"15.1.6","referencingIds":["_ref_573","_ref_574","_ref_678"],"key":"PartitionNumberPattern ( numberFormat, x )"},{"type":"table","id":"table-numbering-system-digits","node":{},"number":10,"caption":"Table 10: Numbering systems with simple digit mappings","referencingIds":["_ref_90","_ref_91","_ref_146"],"key":"Table 10: Numbering systems with simple digit mappings"},{"type":"op","aoid":"PartitionNotationSubPattern","refId":"sec-partitionnotationsubpattern","referencingIds":[],"key":"PartitionNotationSubPattern"},{"type":"clause","id":"sec-partitionnotationsubpattern","aoid":"PartitionNotationSubPattern","titleHTML":"PartitionNotationSubPattern ( <var>numberFormat</var>, <var>x</var>, <var>n</var>, <var>exponent</var> )","number":"15.1.7","referencingIds":["_ref_569"],"key":"PartitionNotationSubPattern ( numberFormat, x, n, exponent )"},{"type":"op","aoid":"FormatNumeric","refId":"sec-formatnumber","referencingIds":[],"key":"FormatNumeric"},{"type":"clause","id":"sec-formatnumber","aoid":"FormatNumeric","titleHTML":"FormatNumeric ( <var>numberFormat</var>, <var>x</var> )","number":"15.1.8","referencingIds":["_ref_144","_ref_145","_ref_147","_ref_148","_ref_149","_ref_150","_ref_151","_ref_152","_ref_153","_ref_154","_ref_341","_ref_342","_ref_343","_ref_344","_ref_560","_ref_723","_ref_726"],"key":"FormatNumeric ( numberFormat, x )"},{"type":"op","aoid":"FormatNumericToParts","refId":"sec-formatnumbertoparts","referencingIds":[],"key":"FormatNumericToParts"},{"type":"clause","id":"sec-formatnumbertoparts","aoid":"FormatNumericToParts","titleHTML":"FormatNumericToParts ( <var>numberFormat</var>, <var>x</var> )","number":"15.1.9","referencingIds":["_ref_618"],"key":"FormatNumericToParts ( numberFormat, x )"},{"type":"op","aoid":"ToRawPrecision","refId":"sec-torawprecision","referencingIds":[],"key":"ToRawPrecision"},{"type":"clause","id":"sec-torawprecision","aoid":"ToRawPrecision","titleHTML":"ToRawPrecision ( <var>x</var>, <var>minPrecision</var>, <var>maxPrecision</var> )","number":"15.1.10","referencingIds":["_ref_561","_ref_563"],"key":"ToRawPrecision ( x, minPrecision, maxPrecision )"},{"type":"op","aoid":"ToRawFixed","refId":"sec-torawfixed","referencingIds":[],"key":"ToRawFixed"},{"type":"clause","id":"sec-torawfixed","aoid":"ToRawFixed","titleHTML":"ToRawFixed ( <var>x</var>, <var>minInteger</var>, <var>minFraction</var>, <var>maxFraction</var> )","number":"15.1.11","referencingIds":["_ref_562","_ref_564","_ref_572"],"key":"ToRawFixed ( x, minInteger, minFraction, maxFraction )"},{"type":"op","aoid":"UnwrapNumberFormat","refId":"sec-unwrapnumberformat","referencingIds":[],"key":"UnwrapNumberFormat"},{"type":"clause","id":"sec-unwrapnumberformat","aoid":"UnwrapNumberFormat","titleHTML":"UnwrapNumberFormat ( <var>nf</var> )","number":"15.1.12","referencingIds":["_ref_614","_ref_619"],"key":"UnwrapNumberFormat ( nf )"},{"type":"op","aoid":"SetNumberFormatUnitOptions","refId":"sec-setnumberformatunitoptions","referencingIds":[],"key":"SetNumberFormatUnitOptions"},{"type":"clause","id":"sec-setnumberformatunitoptions","aoid":"SetNumberFormatUnitOptions","titleHTML":"SetNumberFormatUnitOptions ( <var>intlObj</var>, <var>options</var> )","number":"15.1.13","referencingIds":["_ref_551"],"key":"SetNumberFormatUnitOptions ( intlObj, options )"},{"type":"op","aoid":"GetNumberFormatPattern","refId":"sec-getnumberformatpattern","referencingIds":[],"key":"GetNumberFormatPattern"},{"type":"clause","id":"sec-getnumberformatpattern","aoid":"GetNumberFormatPattern","titleHTML":"GetNumberFormatPattern ( <var>numberFormat</var>, <var>x</var> )","number":"15.1.14","referencingIds":["_ref_567"],"key":"GetNumberFormatPattern ( numberFormat, x )"},{"type":"op","aoid":"GetNotationSubPattern","refId":"sec-getnotationsubpattern","referencingIds":[],"key":"GetNotationSubPattern"},{"type":"clause","id":"sec-getnotationsubpattern","aoid":"GetNotationSubPattern","titleHTML":"GetNotationSubPattern ( <var>numberFormat</var>, <var>exponent</var> )","number":"15.1.15","referencingIds":["_ref_570"],"key":"GetNotationSubPattern ( numberFormat, exponent )"},{"type":"op","aoid":"ComputeExponent","refId":"sec-computeexponent","referencingIds":[],"key":"ComputeExponent"},{"type":"clause","id":"sec-computeexponent","aoid":"ComputeExponent","titleHTML":"ComputeExponent ( <var>numberFormat</var>, <var>x</var> )","number":"15.1.16","referencingIds":["_ref_565"],"key":"ComputeExponent ( numberFormat, x )"},{"type":"op","aoid":"ComputeExponentForMagnitude","refId":"sec-computeexponentformagnitude","referencingIds":[],"key":"ComputeExponentForMagnitude"},{"type":"clause","id":"sec-computeexponentformagnitude","aoid":"ComputeExponentForMagnitude","titleHTML":"ComputeExponentForMagnitude ( <var>numberFormat</var>, <var>magnitude</var> )","number":"15.1.17","referencingIds":["_ref_598","_ref_600"],"key":"ComputeExponentForMagnitude ( numberFormat, magnitude )"},{"type":"clause","id":"sec-numberformat-abstracts","aoid":null,"titleHTML":"Abstract Operations for NumberFormat Objects","number":"15.1","referencingIds":[],"key":"Abstract Operations for NumberFormat Objects"},{"type":"term","term":"%NumberFormat%","refId":"sec-intl-numberformat-constructor","referencingIds":[],"key":"%NumberFormat%"},{"type":"op","aoid":"ChainNumberFormat","refId":"sec-chainnumberformat","referencingIds":[],"key":"ChainNumberFormat"},{"type":"clause","id":"sec-chainnumberformat","aoid":"ChainNumberFormat","titleHTML":"ChainNumberFormat ( <var>numberFormat</var>, <var>newTarget</var>, <var>this</var> )","number":"15.2.1.1","referencingIds":["_ref_604"],"key":"ChainNumberFormat ( numberFormat, newTarget, this )"},{"type":"clause","id":"sec-intl.numberformat","aoid":null,"titleHTML":"Intl.NumberFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"15.2.1","referencingIds":[],"key":"Intl.NumberFormat ( [ locales [ , options ] ] )"},{"type":"clause","id":"sec-intl-numberformat-constructor","aoid":null,"titleHTML":"The Intl.NumberFormat Constructor","number":"15.2","referencingIds":["_ref_9","_ref_159","_ref_167","_ref_171","_ref_178","_ref_331","_ref_335","_ref_339","_ref_547","_ref_549","_ref_550","_ref_580","_ref_583","_ref_596","_ref_597","_ref_606","_ref_610","_ref_613","_ref_669","_ref_722","_ref_725"],"key":"The Intl.NumberFormat Constructor"},{"type":"clause","id":"sec-intl.numberformat.prototype","aoid":null,"titleHTML":"Intl.NumberFormat.prototype","number":"15.3.1","referencingIds":[],"key":"Intl.NumberFormat.prototype"},{"type":"clause","id":"sec-intl.numberformat.supportedlocalesof","aoid":null,"titleHTML":"Intl.NumberFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"15.3.2","referencingIds":[],"key":"Intl.NumberFormat.supportedLocalesOf ( locales [ , options ] )"},{"type":"clause","id":"sec-intl.numberformat-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"15.3.3","referencingIds":["_ref_94","_ref_95","_ref_96","_ref_97","_ref_143"],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-numberformat-constructor","aoid":null,"titleHTML":"Properties of the Intl.NumberFormat Constructor","number":"15.3","referencingIds":[],"key":"Properties of the Intl.NumberFormat Constructor"},{"type":"term","term":"%NumberFormat.prototype%","refId":"sec-properties-of-intl-numberformat-prototype-object","referencingIds":[],"key":"%NumberFormat.prototype%"},{"type":"clause","id":"sec-intl.numberformat.prototype.constructor","aoid":null,"titleHTML":"Intl.NumberFormat.prototype.constructor","number":"15.4.1","referencingIds":[],"key":"Intl.NumberFormat.prototype.constructor"},{"type":"clause","id":"sec-intl.numberformat.prototype-@@tostringtag","aoid":null,"titleHTML":"Intl.NumberFormat.prototype [ @@toStringTag ]","number":"15.4.2","referencingIds":["_ref_164"],"key":"Intl.NumberFormat.prototype [ @@toStringTag ]"},{"type":"clause","id":"sec-intl.numberformat.prototype.format","aoid":null,"titleHTML":"get Intl.NumberFormat.prototype.format","number":"15.4.3","referencingIds":["_ref_108"],"key":"get Intl.NumberFormat.prototype.format"},{"type":"clause","id":"sec-intl.numberformat.prototype.formattoparts","aoid":null,"titleHTML":"Intl.NumberFormat.prototype.formatToParts ( <var>value</var> )","number":"15.4.4","referencingIds":[],"key":"Intl.NumberFormat.prototype.formatToParts ( value )"},{"type":"table","id":"table-numberformat-resolvedoptions-properties","node":{},"number":11,"caption":"Table 11: Resolved Options of NumberFormat Instances","referencingIds":["_ref_107"],"key":"Table 11: Resolved Options of NumberFormat Instances"},{"type":"clause","id":"sec-intl.numberformat.prototype.resolvedoptions","aoid":null,"titleHTML":"Intl.NumberFormat.prototype.resolvedOptions ( )","number":"15.4.5","referencingIds":[],"key":"Intl.NumberFormat.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-intl-numberformat-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.NumberFormat Prototype Object","number":"15.4","referencingIds":["_ref_609","_ref_622"],"key":"Properties of the Intl.NumberFormat Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-numberformat-instances","aoid":null,"titleHTML":"Properties of Intl.NumberFormat Instances","number":"15.5","referencingIds":["_ref_114"],"key":"Properties of Intl.NumberFormat Instances"},{"type":"clause","id":"numberformat-objects","aoid":null,"titleHTML":"NumberFormat Objects","number":"15","referencingIds":["_ref_28"],"key":"NumberFormat Objects"},{"type":"op","aoid":"InitializePluralRules","refId":"sec-initializepluralrules","referencingIds":[],"key":"InitializePluralRules"},{"type":"clause","id":"sec-initializepluralrules","aoid":"InitializePluralRules","titleHTML":"InitializePluralRules ( <var>pluralRules</var>, <var>locales</var>, <var>options</var> )","number":"16.1.1","referencingIds":["_ref_155","_ref_644"],"key":"InitializePluralRules ( pluralRules, locales, options )"},{"type":"table","id":"table-plural-operands","node":{},"number":12,"caption":"Table 12: Plural Rules Operands Record Fields","referencingIds":[],"key":"Table 12: Plural Rules Operands Record Fields"},{"type":"op","aoid":"GetOperands","refId":"sec-getoperands","referencingIds":[],"key":"GetOperands"},{"type":"clause","id":"sec-getoperands","aoid":"GetOperands","titleHTML":"GetOperands ( <var>s</var> )","number":"16.1.2","referencingIds":["_ref_640"],"key":"GetOperands ( s )"},{"type":"op","aoid":"PluralRuleSelect","refId":"sec-pluralruleselect","referencingIds":[],"key":"PluralRuleSelect"},{"type":"clause","id":"sec-pluralruleselect","aoid":"PluralRuleSelect","titleHTML":"PluralRuleSelect ( <var>locale</var>, <var>type</var>, <var>n</var>, <var>operands</var> )","number":"16.1.3","referencingIds":["_ref_113","_ref_641"],"key":"PluralRuleSelect ( locale, type, n, operands )"},{"type":"op","aoid":"ResolvePlural","refId":"sec-resolveplural","referencingIds":[],"key":"ResolvePlural"},{"type":"clause","id":"sec-resolveplural","aoid":"ResolvePlural","titleHTML":"ResolvePlural ( <var>pluralRules</var>, <var>n</var> )","number":"16.1.4","referencingIds":["_ref_652","_ref_679"],"key":"ResolvePlural ( pluralRules, n )"},{"type":"clause","id":"sec-intl-pluralrules-abstracts","aoid":null,"titleHTML":"Abstract Operations for PluralRules Objects","number":"16.1","referencingIds":[],"key":"Abstract Operations for PluralRules Objects"},{"type":"term","term":"%PluralRules%","refId":"sec-intl-pluralrules-constructor","referencingIds":[],"key":"%PluralRules%"},{"type":"clause","id":"sec-intl.pluralrules","aoid":null,"titleHTML":"Intl.PluralRules ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"16.2.1","referencingIds":[],"key":"Intl.PluralRules ( [ locales [ , options ] ] )"},{"type":"clause","id":"sec-intl-pluralrules-constructor","aoid":null,"titleHTML":"The Intl.PluralRules Constructor","number":"16.2","referencingIds":["_ref_10","_ref_179","_ref_628","_ref_630","_ref_631","_ref_646","_ref_649","_ref_671"],"key":"The Intl.PluralRules Constructor"},{"type":"clause","id":"sec-intl.pluralrules.prototype","aoid":null,"titleHTML":"Intl.PluralRules.prototype","number":"16.3.1","referencingIds":[],"key":"Intl.PluralRules.prototype"},{"type":"clause","id":"sec-intl.pluralrules.supportedlocalesof","aoid":null,"titleHTML":"Intl.PluralRules.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"16.3.2","referencingIds":[],"key":"Intl.PluralRules.supportedLocalesOf ( locales [ , options ] )"},{"type":"clause","id":"sec-intl.pluralrules-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"16.3.3","referencingIds":[],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-pluralrules-constructor","aoid":null,"titleHTML":"Properties of the Intl.PluralRules Constructor","number":"16.3","referencingIds":[],"key":"Properties of the Intl.PluralRules Constructor"},{"type":"term","term":"%PluralRules.prototype%","refId":"sec-properties-of-intl-pluralrules-prototype-object","referencingIds":[],"key":"%PluralRules.prototype%"},{"type":"clause","id":"sec-intl.pluralrules.prototype.constructor","aoid":null,"titleHTML":"Intl.PluralRules.prototype.constructor","number":"16.4.1","referencingIds":[],"key":"Intl.PluralRules.prototype.constructor"},{"type":"clause","id":"sec-intl.pluralrules.prototype-tostringtag","aoid":null,"titleHTML":"Intl.PluralRules.prototype [ @@toStringTag ]","number":"16.4.2","referencingIds":["_ref_165"],"key":"Intl.PluralRules.prototype [ @@toStringTag ]"},{"type":"clause","id":"sec-intl.pluralrules.prototype.select","aoid":null,"titleHTML":"Intl.PluralRules.prototype.select ( <var>value</var> )","number":"16.4.3","referencingIds":[],"key":"Intl.PluralRules.prototype.select ( value )"},{"type":"table","id":"table-pluralrules-resolvedoptions-properties","node":{},"number":13,"caption":"Table 13: Resolved Options of PluralRules Instances","referencingIds":["_ref_112"],"key":"Table 13: Resolved Options of PluralRules Instances"},{"type":"clause","id":"sec-intl.pluralrules.prototype.resolvedoptions","aoid":null,"titleHTML":"Intl.PluralRules.prototype.resolvedOptions ( )","number":"16.4.4","referencingIds":[],"key":"Intl.PluralRules.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-intl-pluralrules-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.PluralRules Prototype Object","number":"16.4","referencingIds":["_ref_645","_ref_657"],"key":"Properties of the Intl.PluralRules Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-pluralrules-instances","aoid":null,"titleHTML":"Properties of Intl.PluralRules Instances","number":"16.5","referencingIds":[],"key":"Properties of Intl.PluralRules Instances"},{"type":"clause","id":"pluralrules-objects","aoid":null,"titleHTML":"PluralRules Objects","number":"16","referencingIds":["_ref_29"],"key":"PluralRules Objects"},{"type":"op","aoid":"InitializeRelativeTimeFormat","refId":"sec-InitializeRelativeTimeFormat","referencingIds":[],"key":"InitializeRelativeTimeFormat"},{"type":"clause","id":"sec-InitializeRelativeTimeFormat","aoid":"InitializeRelativeTimeFormat","titleHTML":"InitializeRelativeTimeFormat ( <var>relativeTimeFormat</var>, <var>locales</var>, <var>options</var> )","number":"17.1.1","referencingIds":["_ref_692"],"key":"InitializeRelativeTimeFormat ( relativeTimeFormat, locales, options )"},{"type":"op","aoid":"SingularRelativeTimeUnit","refId":"sec-singularrelativetimeunit","referencingIds":[],"key":"SingularRelativeTimeUnit"},{"type":"clause","id":"sec-singularrelativetimeunit","aoid":"SingularRelativeTimeUnit","titleHTML":"SingularRelativeTimeUnit ( <var>unit</var> )","number":"17.1.2","referencingIds":["_ref_675"],"key":"SingularRelativeTimeUnit ( unit )"},{"type":"op","aoid":"PartitionRelativeTimePattern","refId":"sec-PartitionRelativeTimePattern","referencingIds":[],"key":"PartitionRelativeTimePattern"},{"type":"clause","id":"sec-PartitionRelativeTimePattern","aoid":"PartitionRelativeTimePattern","titleHTML":"PartitionRelativeTimePattern ( <var>relativeTimeFormat</var>, <var>value</var>, <var>unit</var> )","number":"17.1.3","referencingIds":["_ref_682","_ref_683"],"key":"PartitionRelativeTimePattern ( relativeTimeFormat, value, unit )"},{"type":"op","aoid":"MakePartsList","refId":"sec-makepartslist","referencingIds":[],"key":"MakePartsList"},{"type":"clause","id":"sec-makepartslist","aoid":"MakePartsList","titleHTML":"MakePartsList ( <var>pattern</var>, <var>unit</var>, <var>parts</var> )","number":"17.1.4","referencingIds":["_ref_680"],"key":"MakePartsList ( pattern, unit, parts )"},{"type":"op","aoid":"FormatRelativeTime","refId":"sec-FormatRelativeTime","referencingIds":[],"key":"FormatRelativeTime"},{"type":"clause","id":"sec-FormatRelativeTime","aoid":"FormatRelativeTime","titleHTML":"FormatRelativeTime ( <var>relativeTimeFormat</var>, <var>value</var>, <var>unit</var> )","number":"17.1.5","referencingIds":["_ref_702"],"key":"FormatRelativeTime ( relativeTimeFormat, value, unit )"},{"type":"op","aoid":"FormatRelativeTimeToParts","refId":"sec-FormatRelativeTimeToParts","referencingIds":[],"key":"FormatRelativeTimeToParts"},{"type":"clause","id":"sec-FormatRelativeTimeToParts","aoid":"FormatRelativeTimeToParts","titleHTML":"FormatRelativeTimeToParts ( <var>relativeTimeFormat</var>, <var>value</var>, <var>unit</var> )","number":"17.1.6","referencingIds":["_ref_706"],"key":"FormatRelativeTimeToParts ( relativeTimeFormat, value, unit )"},{"type":"clause","id":"sec-intl-relativetimeformat--abstracts","aoid":null,"titleHTML":"Abstract Operations for RelativeTimeFormat Objects","number":"17.1","referencingIds":[],"key":"Abstract Operations for RelativeTimeFormat Objects"},{"type":"term","term":"%RelativeTimeFormat%","refId":"sec-intl-relativetimeformat-constructor","referencingIds":[],"key":"%RelativeTimeFormat%"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat","aoid":null,"titleHTML":"Intl.RelativeTimeFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"17.2.1","referencingIds":[],"key":"Intl.RelativeTimeFormat ( [ locales [ , options ] ] )"},{"type":"clause","id":"sec-intl-relativetimeformat-constructor","aoid":null,"titleHTML":"The Intl.RelativeTimeFormat Constructor","number":"17.2","referencingIds":["_ref_11","_ref_180","_ref_662","_ref_664","_ref_665","_ref_676","_ref_694","_ref_698"],"key":"The Intl.RelativeTimeFormat Constructor"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.prototype","number":"17.3.1","referencingIds":[],"key":"Intl.RelativeTimeFormat.prototype"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.supportedLocalesOf","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"17.3.2","referencingIds":[],"key":"Intl.RelativeTimeFormat.supportedLocalesOf ( locales [ , options ] )"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat-internal-slots","aoid":null,"titleHTML":"Internal slots","number":"17.3.3","referencingIds":["_ref_156","_ref_157"],"key":"Internal slots"},{"type":"clause","id":"sec-properties-of-intl-relativetimeformat-constructor","aoid":null,"titleHTML":"Properties of the Intl.RelativeTimeFormat Constructor","number":"17.3","referencingIds":[],"key":"Properties of the Intl.RelativeTimeFormat Constructor"},{"type":"term","term":"%RelativeTimeFormat.prototype%","refId":"sec-properties-of-intl-relativetimeformat-prototype-object","referencingIds":[],"key":"%RelativeTimeFormat.prototype%"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype.constructor","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.prototype.constructor","number":"17.4.1","referencingIds":[],"key":"Intl.RelativeTimeFormat.prototype.constructor"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype-toStringTag","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.prototype[ @@toStringTag ]","number":"17.4.2","referencingIds":[],"key":"Intl.RelativeTimeFormat.prototype[ @@toStringTag ]"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype.format","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.prototype.format ( <var>value</var>, <var>unit</var> )","number":"17.4.3","referencingIds":[],"key":"Intl.RelativeTimeFormat.prototype.format ( value, unit )"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype.formatToParts","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.prototype.formatToParts ( <var>value</var>, <var>unit</var> )","number":"17.4.4","referencingIds":[],"key":"Intl.RelativeTimeFormat.prototype.formatToParts ( value, unit )"},{"type":"table","id":"table-relativetimeformat-resolvedoptions-properties","node":{},"number":14,"caption":"Table 14: Resolved Options of RelativeTimeFormat Instances","referencingIds":["_ref_118"],"key":"Table 14: Resolved Options of RelativeTimeFormat Instances"},{"type":"clause","id":"sec-intl.relativetimeformat.prototype.resolvedoptions","aoid":null,"titleHTML":"Intl.RelativeTimeFormat.prototype.resolvedOptions ( )","number":"17.4.5","referencingIds":[],"key":"Intl.RelativeTimeFormat.prototype.resolvedOptions ( )"},{"type":"clause","id":"sec-properties-of-intl-relativetimeformat-prototype-object","aoid":null,"titleHTML":"Properties of the Intl.RelativeTimeFormat Prototype Object","number":"17.4","referencingIds":["_ref_693","_ref_709"],"key":"Properties of the Intl.RelativeTimeFormat Prototype Object"},{"type":"clause","id":"sec-properties-of-intl-relativetimeformat-instances","aoid":null,"titleHTML":"Properties of Intl.RelativeTimeFormat Instances","number":"17.5","referencingIds":[],"key":"Properties of Intl.RelativeTimeFormat Instances"},{"type":"clause","id":"relativetimeformat-objects","aoid":null,"titleHTML":"RelativeTimeFormat Objects","number":"17","referencingIds":["_ref_30"],"key":"RelativeTimeFormat Objects"},{"type":"clause","id":"sup-String.prototype.localeCompare","aoid":null,"titleHTML":"String.prototype.localeCompare ( <var>that</var> [ , <var>locales</var> [ , <var>options</var> ] ] )","number":"18.1.1","referencingIds":[],"key":"String.prototype.localeCompare ( that [ , locales [ , options ] ] )"},{"type":"clause","id":"sup-string.prototype.tolocalelowercase","aoid":null,"titleHTML":"String.prototype.toLocaleLowerCase ( [ <var>locales</var> ] )","number":"18.1.2","referencingIds":[],"key":"String.prototype.toLocaleLowerCase ( [ locales ] )"},{"type":"clause","id":"sup-string.prototype.tolocaleuppercase","aoid":null,"titleHTML":"String.prototype.toLocaleUpperCase ( [ <var>locales</var> ] )","number":"18.1.3","referencingIds":[],"key":"String.prototype.toLocaleUpperCase ( [ locales ] )"},{"type":"clause","id":"sup-properties-of-the-string-prototype-object","aoid":null,"titleHTML":"Properties of the String Prototype Object","number":"18.1","referencingIds":[],"key":"Properties of the String Prototype Object"},{"type":"clause","id":"sup-number.prototype.tolocalestring","aoid":null,"titleHTML":"Number.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.2.1","referencingIds":[],"key":"Number.prototype.toLocaleString ( [ locales [ , options ] ] )"},{"type":"clause","id":"sup-properties-of-the-number-prototype-object","aoid":null,"titleHTML":"Properties of the Number Prototype Object","number":"18.2","referencingIds":[],"key":"Properties of the Number Prototype Object"},{"type":"clause","id":"sup-bigint.prototype.tolocalestring","aoid":null,"titleHTML":"BigInt.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.3.1","referencingIds":[],"key":"BigInt.prototype.toLocaleString ( [ locales [ , options ] ] )"},{"type":"clause","id":"sup-properties-of-the-bigint-prototype-object","aoid":null,"titleHTML":"Properties of the BigInt Prototype Object","number":"18.3","referencingIds":[],"key":"Properties of the BigInt Prototype Object"},{"type":"clause","id":"sup-date.prototype.tolocalestring","aoid":null,"titleHTML":"Date.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.4.1","referencingIds":[],"key":"Date.prototype.toLocaleString ( [ locales [ , options ] ] )"},{"type":"clause","id":"sup-date.prototype.tolocaledatestring","aoid":null,"titleHTML":"Date.prototype.toLocaleDateString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.4.2","referencingIds":[],"key":"Date.prototype.toLocaleDateString ( [ locales [ , options ] ] )"},{"type":"clause","id":"sup-date.prototype.tolocaletimestring","aoid":null,"titleHTML":"Date.prototype.toLocaleTimeString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.4.3","referencingIds":[],"key":"Date.prototype.toLocaleTimeString ( [ locales [ , options ] ] )"},{"type":"clause","id":"sup-properties-of-the-date-prototype-object","aoid":null,"titleHTML":"Properties of the Date Prototype Object","number":"18.4","referencingIds":[],"key":"Properties of the Date Prototype Object"},{"type":"clause","id":"sup-array.prototype.tolocalestring","aoid":null,"titleHTML":"Array.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.5.1","referencingIds":[],"key":"Array.prototype.toLocaleString ( [ locales [ , options ] ] )"},{"type":"clause","id":"sup-properties-of-the-array-prototype-object","aoid":null,"titleHTML":"Properties of the Array Prototype Object","number":"18.5","referencingIds":[],"key":"Properties of the Array Prototype Object"},{"type":"clause","id":"locale-sensitive-functions","aoid":null,"titleHTML":"Locale Sensitive Functions of the ECMAScript Language Specification","number":"18","referencingIds":[],"key":"Locale Sensitive Functions of the ECMAScript Language Specification"},{"type":"clause","id":"annex-implementation-dependent-behaviour","aoid":null,"titleHTML":"Implementation Dependent Behaviour","number":"A","referencingIds":[],"key":"Implementation Dependent Behaviour"},{"type":"clause","id":"annex-incompatibilities","aoid":null,"titleHTML":"Additions and Changes That Introduce Incompatibilities with Prior Editions","number":"B","referencingIds":[],"key":"Additions and Changes That Introduce Incompatibilities with Prior Editions"},{"type":"clause","id":"sec-colophon","aoid":null,"titleHTML":"Colophon","number":"C","referencingIds":["_ref_0"],"key":"Colophon"},{"type":"clause","id":"sec-copyright-and-software-license","aoid":null,"titleHTML":"Copyright &amp; Software License","number":"D","referencingIds":[],"key":"Copyright & Software License"}]}`);
;let usesMultipage = false