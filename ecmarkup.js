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
  if (e.key === '/') {
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

  relevance += Math.max(0, 255 - result.key.length);

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
      .map(clause => ({ key: getKey(clause), entry: clause }));
  } else {
    results = [];

    for (let i = 0; i < this.biblio.entries.length; i++) {
      let entry = this.biblio.entries[i];
      let key = getKey(entry);
      if (!key) {
        // biblio entries without a key aren't searchable
        continue;
      }

      let match = fuzzysearch(searchString, key);
      if (match) {
        results.push({ key, entry, match });
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
      let key = result.key;
      let entry = result.entry;
      let id = entry.id;
      let cssClass = '';
      let text = '';

      if (entry.type === 'clause') {
        let number = entry.number ? entry.number + ' ' : '';
        text = number + key;
        cssClass = 'clause';
        id = entry.id;
      } else if (entry.type === 'production') {
        text = key;
        cssClass = 'prod';
        id = entry.id;
      } else if (entry.type === 'op') {
        text = key;
        cssClass = 'op';
        id = entry.id || entry.refId;
      } else if (entry.type === 'term') {
        text = key;
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

function getKey(item) {
  if (item.key) {
    return item.key;
  }
  switch (item.type) {
    case 'clause':
      return item.title || item.titleHTML;
    case 'production':
      return item.name;
    case 'op':
      return item.aoid;
    case 'term':
      return item.term;
    case 'table':
    case 'figure':
    case 'example':
    case 'note':
      return item.caption;
    case 'step':
      return item.id;
    default:
      throw new Error("Can't get key for " + item.type);
  }
}

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
    this.$pinList.innerHTML += `<li><a href="${makeLinkToId(entry.id)}">${getKey(entry)}</a></li>`;
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
    (entry.referencingIds || [])
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
      this.$pinLink.textContent = menu._pinnedIds[this.entry.id] ? 'Unpin' : 'Pin';
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
    this.$pinLink.textContent = menu._pinnedIds[entry.id] ? 'Unpin' : 'Pin';
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
    this.$refsLink.textContent = `References (${(this.entry.referencingIds || []).length})`;
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
  if (e.altKey || e.ctrlKey || e.metaKey) {
    return;
  }
  if (e.key === 'm' && usesMultipage) {
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
  } else if (e.key === 'u') {
    document.documentElement.classList.toggle('show-ao-annotations');
  } else if (e.key === '?') {
    document.getElementById('shortcuts-help').classList.toggle('active');
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
      if (e.code === 'Escape') {
        if (Toolbox.active) {
          Toolbox.deactivate();
        }
        document.getElementById('shortcuts-help').classList.remove('active');
      }
    })
  );
}

document.addEventListener('keypress', doShortcut);

document.addEventListener('DOMContentLoaded', () => {
  Toolbox.init();
  referencePane.init();
});

// preserve state during navigation

function getTocPath(li) {
  let path = [];
  let pointer = li;
  while (true) {
    let parent = pointer.parentElement;
    if (parent == null) {
      return null;
    }
    let index = [].indexOf.call(parent.children, pointer);
    if (index == -1) {
      return null;
    }
    path.unshift(index);
    pointer = parent.parentElement;
    if (pointer == null) {
      return null;
    }
    if (pointer.id === 'menu-toc') {
      break;
    }
    if (pointer.tagName !== 'LI') {
      return null;
    }
  }
  return path;
}

function activateTocPath(path) {
  try {
    let pointer = document.getElementById('menu-toc');
    for (let index of path) {
      pointer = pointer.querySelector('ol').children[index];
    }
    pointer.classList.add('active');
  } catch (e) {
    // pass
  }
}

function getActiveTocPaths() {
  return [...menu.$menu.querySelectorAll('.active')].map(getTocPath).filter(p => p != null);
}

function loadStateFromSessionStorage() {
  if (!window.sessionStorage || typeof menu === 'undefined' || window.navigating) {
    return;
  }
  if (sessionStorage.referencePaneState != null) {
    let state = JSON.parse(sessionStorage.referencePaneState);
    if (state != null) {
      if (state.type === 'ref') {
        let entry = menu.search.biblio.byId[state.id];
        if (entry != null) {
          referencePane.showReferencesFor(entry);
        }
      } else if (state.type === 'sdo') {
        let sdos = sdoMap[state.id];
        if (sdos != null) {
          referencePane.$headerText.innerHTML = state.html;
          referencePane.showSDOsBody(sdos, state.id);
        }
      }
      delete sessionStorage.referencePaneState;
    }
  }

  if (sessionStorage.activeTocPaths != null) {
    document
      .getElementById('menu-toc')
      .querySelectorAll('.active')
      .forEach(e => {
        e.classList.remove('active');
      });
    let active = JSON.parse(sessionStorage.activeTocPaths);
    active.forEach(activateTocPath);
    delete sessionStorage.activeTocPaths;
  }

  if (sessionStorage.searchValue != null) {
    let value = JSON.parse(sessionStorage.searchValue);
    menu.search.$searchBox.value = value;
    menu.search.search(value);
    delete sessionStorage.searchValue;
  }

  if (sessionStorage.tocScroll != null) {
    let tocScroll = JSON.parse(sessionStorage.tocScroll);
    menu.$toc.scrollTop = tocScroll;
    delete sessionStorage.tocScroll;
  }
}

document.addEventListener('DOMContentLoaded', loadStateFromSessionStorage);

window.addEventListener('pageshow', loadStateFromSessionStorage);

window.addEventListener('beforeunload', () => {
  if (!window.sessionStorage || typeof menu === 'undefined') {
    return;
  }
  sessionStorage.referencePaneState = JSON.stringify(referencePane.state || null);
  sessionStorage.activeTocPaths = JSON.stringify(getActiveTocPaths());
  sessionStorage.searchValue = JSON.stringify(menu.search.$searchBox.value);
  sessionStorage.tocScroll = JSON.stringify(menu.$toc.scrollTop);
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
let biblio = JSON.parse(`{"refsByClause":{"sec-intro":["_ref_0"],"conformance":["_ref_1"],"sec-api-conventions":["_ref_2","_ref_171","_ref_172","_ref_173"],"sec-402-well-known-intrinsic-objects":["_ref_3","_ref_4","_ref_5","_ref_6","_ref_7","_ref_8","_ref_9","_ref_10","_ref_11","_ref_12","_ref_174","_ref_175","_ref_176","_ref_177","_ref_178","_ref_179","_ref_180","_ref_181","_ref_182","_ref_183"],"sec-language-tags":["_ref_13"],"sec-defaultlocale":["_ref_14","_ref_15"],"sec-defaulttimezone":["_ref_16","_ref_17"],"sec-issanctionedsingleunitidentifier":["_ref_18"],"sec-intl.collator-intro":["_ref_19"],"sec-intl.datetimeformat-intro":["_ref_20"],"sec-intl.displaynames-intro":["_ref_21"],"sec-intl.listformat-intro":["_ref_22"],"sec-intl.locale-intro":["_ref_23"],"sec-intl.numberformat-intro":["_ref_24"],"sec-intl.pluralrules-intro":["_ref_25"],"sec-intl.relativetimeformat-intro":["_ref_26"],"sec-intl.segmenter-intro":["_ref_27"],"locale-and-parameter-negotiation":["_ref_28"],"sec-internal-slots":["_ref_29","_ref_30","_ref_31","_ref_32","_ref_33","_ref_200","_ref_201","_ref_202","_ref_203"],"sec-abstract-operations":["_ref_34"],"sec-the-intl-collator-constructor":["_ref_35","_ref_235"],"sec-intl-collator-internal-slots":["_ref_36","_ref_37"],"sec-intl.collator.prototype.compare":["_ref_38"],"sec-intl.collator.prototype.resolvedoptions":["_ref_39","_ref_259"],"sec-properties-of-intl-collator-instances":["_ref_40","_ref_41","_ref_260"],"sec-intl-datetimeformat-constructor":["_ref_42","_ref_261"],"sec-intl.datetimeformat":["_ref_43","_ref_262","_ref_263"],"sec-initializedatetimeformat":["_ref_44","_ref_45","_ref_266","_ref_267","_ref_268","_ref_269","_ref_270","_ref_271","_ref_272","_ref_273","_ref_274","_ref_275","_ref_276","_ref_277","_ref_278","_ref_279","_ref_280","_ref_281","_ref_282","_ref_283","_ref_284","_ref_285","_ref_286","_ref_287"],"sec-intl.datetimeformat-internal-slots":["_ref_46","_ref_47","_ref_48","_ref_49","_ref_50","_ref_51","_ref_52","_ref_53","_ref_54"],"sec-intl.datetimeformat.prototype.format":["_ref_55","_ref_56","_ref_293"],"sec-intl.datetimeformat.prototype.resolvedoptions":["_ref_57","_ref_58","_ref_59","_ref_297"],"sec-properties-of-intl-datetimeformat-instances":["_ref_60","_ref_61","_ref_62","_ref_63","_ref_298"],"sec-basicformatmatcher":["_ref_64"],"sec-formatdatetimepattern":["_ref_65","_ref_302","_ref_303","_ref_304","_ref_305","_ref_306","_ref_307","_ref_308","_ref_309","_ref_310"],"sec-partitiondatetimerangepattern":["_ref_66","_ref_315","_ref_316","_ref_317","_ref_318","_ref_319","_ref_320"],"sec-tolocaltime":["_ref_67","_ref_68","_ref_323"],"sec-unwrapdatetimeformat":["_ref_69","_ref_324","_ref_325","_ref_326"],"sec-intl-displaynames-constructor":["_ref_70","_ref_327"],"sec-Intl.DisplayNames":["_ref_71","_ref_72","_ref_73","_ref_74","_ref_328","_ref_329","_ref_330","_ref_331","_ref_332","_ref_333","_ref_334","_ref_335","_ref_336","_ref_337","_ref_338"],"sec-Intl.DisplayNames-internal-slots":["_ref_75","_ref_76","_ref_77"],"sec-Intl.DisplayNames.prototype.resolvedOptions":["_ref_78"],"sec-properties-of-intl-displaynames-instances":["_ref_79","_ref_345"],"sec-isvaliddatetimefieldcode":["_ref_80"],"sec-intl-listformat-constructor":["_ref_81","_ref_355"],"sec-Intl.ListFormat-internal-slots":["_ref_82","_ref_83","_ref_369"],"sec-Intl.ListFormat.prototype.resolvedoptions":["_ref_84"],"sec-intl-numberformat-constructor":["_ref_85","_ref_412"],"sec-intl.numberformat":["_ref_86","_ref_413","_ref_414"],"sec-setnfdigitoptions":["_ref_87","_ref_432","_ref_433","_ref_434","_ref_435","_ref_436"],"sec-intl.numberformat-internal-slots":["_ref_88","_ref_89","_ref_90","_ref_91"],"sec-intl.numberformat.prototype.format":["_ref_92","_ref_93","_ref_451"],"sec-intl.numberformat.prototype.resolvedoptions":["_ref_94","_ref_95","_ref_453"],"sec-properties-of-intl-numberformat-instances":["_ref_96","_ref_454"],"sec-partitionnotationsubpattern":["_ref_97","_ref_98","_ref_465","_ref_466","_ref_467"],"sec-unwrapnumberformat":["_ref_99","_ref_470","_ref_471","_ref_472"],"sec-getnumberformatpattern":["_ref_100","_ref_101","_ref_473"],"sec-getnotationsubpattern":["_ref_102","_ref_103","_ref_474"],"sec-intl-pluralrules-constructor":["_ref_104","_ref_478"],"sec-intl.pluralrules-internal-slots":["_ref_105","_ref_106"],"sec-intl.pluralrules.prototype.resolvedoptions":["_ref_107","_ref_108"],"sec-properties-of-intl-pluralrules-instances":["_ref_109","_ref_495"],"sec-intl-relativetimeformat-constructor":["_ref_110","_ref_499"],"sec-Intl.RelativeTimeFormat-internal-slots":["_ref_111","_ref_112"],"sec-intl.relativetimeformat.prototype.resolvedoptions":["_ref_113"],"sec-intl-segmenter-constructor":["_ref_114","_ref_530"],"sec-intl.segmenter-internal-slots":["_ref_115","_ref_116"],"sec-intl.segmenter.prototype.resolvedoptions":["_ref_117"],"sec-properties-of-segment-iterator-instances":["_ref_118","_ref_555"],"sec-transform-case":["_ref_119","_ref_559","_ref_560","_ref_561"],"annex-implementation-dependent-behaviour":["_ref_120","_ref_121","_ref_122","_ref_123","_ref_124","_ref_125","_ref_126","_ref_127","_ref_128","_ref_129","_ref_130","_ref_131","_ref_132","_ref_133","_ref_134","_ref_135","_ref_136","_ref_137","_ref_138","_ref_139","_ref_140","_ref_141","_ref_142","_ref_143","_ref_144","_ref_145","_ref_146","_ref_147","_ref_148","_ref_149","_ref_150","_ref_151","_ref_152","_ref_153","_ref_154","_ref_155","_ref_156","_ref_157","_ref_158","_ref_159","_ref_576","_ref_577","_ref_578"],"annex-incompatibilities":["_ref_160","_ref_161","_ref_162","_ref_163","_ref_164","_ref_165","_ref_166","_ref_167","_ref_168","_ref_169"],"sec-api-overview":["_ref_170"],"sec-isstructurallyvalidlanguagetag":["_ref_184"],"sec-canonicalizeunicodelocaleid":["_ref_185","_ref_186","_ref_187","_ref_188"],"sec-iswellformedcurrencycode":["_ref_189"],"sec-time-zone-names":["_ref_190","_ref_193"],"sec-isvalidtimezonename":["_ref_191","_ref_192"],"sec-canonicalizetimezonename":["_ref_194","_ref_195"],"sec-iswellformedunitidentifier":["_ref_196","_ref_197","_ref_198"],"sec-intl.getcanonicallocales":["_ref_199"],"sec-canonicalizelocalelist":["_ref_204","_ref_205"],"sec-lookupmatcher":["_ref_206","_ref_207","_ref_208","_ref_209","_ref_210","_ref_211"],"sec-bestfitmatcher":["_ref_212","_ref_213","_ref_214","_ref_215"],"sec-unicode-extension-components":["_ref_216"],"sec-insert-unicode-extension-and-canonicalize":["_ref_217","_ref_218","_ref_219","_ref_220","_ref_221"],"sec-resolvelocale":["_ref_222","_ref_223","_ref_224","_ref_225"],"sec-lookupsupportedlocales":["_ref_226"],"sec-supportedlocales":["_ref_227","_ref_228","_ref_229","_ref_230"],"sec-getoptionsobject":["_ref_231"],"sec-coerceoptionstoobject":["_ref_232","_ref_233"],"sec-getnumberoption":["_ref_234"],"sec-intl.collator":["_ref_236","_ref_237","_ref_238"],"sec-initializecollator":["_ref_239","_ref_240","_ref_241","_ref_242","_ref_243","_ref_244","_ref_245","_ref_246","_ref_247","_ref_248","_ref_249","_ref_250","_ref_251","_ref_252"],"sec-intl.collator.prototype":["_ref_253"],"sec-intl.collator.supportedlocalesof":["_ref_254","_ref_255","_ref_256"],"sec-intl.collator.prototype.constructor":["_ref_257"],"sec-collator-compare-functions":["_ref_258"],"sec-chaindatetimeformat":["_ref_264","_ref_265"],"sec-intl.datetimeformat.prototype":["_ref_288"],"sec-intl.datetimeformat.supportedlocalesof":["_ref_289","_ref_290","_ref_291"],"sec-intl.datetimeformat.prototype.constructor":["_ref_292"],"sec-Intl.DateTimeFormat.prototype.formatToParts":["_ref_294"],"sec-intl.datetimeformat.prototype.formatRange":["_ref_295"],"sec-Intl.DateTimeFormat.prototype.formatRangeToParts":["_ref_296"],"sec-date-time-style-format":["_ref_299"],"sec-bestfitformatmatcher":["_ref_300"],"sec-datetime-format-functions":["_ref_301"],"sec-partitiondatetimepattern":["_ref_311","_ref_312"],"sec-formatdatetime":["_ref_313"],"sec-formatdatetimetoparts":["_ref_314"],"sec-formatdatetimerange":["_ref_321"],"sec-formatdatetimerangetoparts":["_ref_322"],"sec-Intl.DisplayNames.prototype":["_ref_339"],"sec-Intl.DisplayNames.supportedLocalesOf":["_ref_340","_ref_341","_ref_342"],"sec-Intl.DisplayNames.prototype.constructor":["_ref_343"],"sec-Intl.DisplayNames.prototype.of":["_ref_344"],"sec-canonicalcodefordisplaynames":["_ref_346","_ref_347","_ref_348","_ref_349","_ref_350","_ref_351","_ref_352","_ref_353","_ref_354"],"sec-Intl.ListFormat":["_ref_356","_ref_357","_ref_358","_ref_359","_ref_360","_ref_361","_ref_362","_ref_363","_ref_364"],"sec-Intl.ListFormat.prototype":["_ref_365"],"sec-Intl.ListFormat.supportedLocalesOf":["_ref_366","_ref_367","_ref_368"],"sec-Intl.ListFormat.prototype.constructor":["_ref_370"],"sec-Intl.ListFormat.prototype.format":["_ref_371","_ref_372"],"sec-Intl.ListFormat.prototype.formatToParts":["_ref_373","_ref_374"],"sec-properties-of-intl-listformat-instances":["_ref_375","_ref_376"],"sec-deconstructpattern":["_ref_377"],"sec-createpartsfromlist":["_ref_378","_ref_379"],"sec-formatlist":["_ref_380"],"sec-formatlisttoparts":["_ref_381"],"sec-Intl.Locale":["_ref_382","_ref_383","_ref_384","_ref_385","_ref_386","_ref_387","_ref_388","_ref_389","_ref_390","_ref_391"],"sec-apply-options-to-tag":["_ref_392","_ref_393","_ref_394","_ref_395","_ref_396","_ref_397"],"sec-apply-unicode-extension-to-tag":["_ref_398","_ref_399","_ref_400","_ref_401"],"sec-Intl.Locale.prototype":["_ref_402"],"sec-intl.locale-internal-slots":["_ref_403","_ref_404","_ref_405","_ref_406"],"sec-Intl.Locale.prototype.constructor":["_ref_407"],"sec-Intl.Locale.prototype.maximize":["_ref_408"],"sec-Intl.Locale.prototype.minimize":["_ref_409"],"sec-Intl.Locale.prototype.caseFirst":["_ref_410"],"sec-Intl.Locale.prototype.numeric":["_ref_411"],"sec-chainnumberformat":["_ref_415","_ref_416"],"sec-initializenumberformat":["_ref_417","_ref_418","_ref_419","_ref_420","_ref_421","_ref_422","_ref_423","_ref_424","_ref_425","_ref_426","_ref_427","_ref_428","_ref_429","_ref_430","_ref_431"],"sec-setnumberformatunitoptions":["_ref_437","_ref_438","_ref_439","_ref_440","_ref_441","_ref_442","_ref_443","_ref_444","_ref_445"],"sec-intl.numberformat.prototype":["_ref_446"],"sec-intl.numberformat.supportedlocalesof":["_ref_447","_ref_448","_ref_449"],"sec-intl.numberformat.prototype.constructor":["_ref_450"],"sec-intl.numberformat.prototype.formattoparts":["_ref_452"],"sec-number-format-functions":["_ref_455"],"sec-formatnumberstring":["_ref_456","_ref_457","_ref_458","_ref_459"],"sec-partitionnumberpattern":["_ref_460","_ref_461","_ref_462","_ref_463","_ref_464"],"sec-formatnumber":["_ref_468"],"sec-formatnumbertoparts":["_ref_469"],"sec-computeexponent":["_ref_475","_ref_476","_ref_477"],"sec-intl.pluralrules":["_ref_479"],"sec-initializepluralrules":["_ref_480","_ref_481","_ref_482","_ref_483","_ref_484","_ref_485","_ref_486","_ref_487","_ref_488"],"sec-intl.pluralrules.prototype":["_ref_489"],"sec-intl.pluralrules.supportedlocalesof":["_ref_490","_ref_491","_ref_492"],"sec-intl.pluralrules.prototype.constructor":["_ref_493"],"sec-intl.pluralrules.prototype.select":["_ref_494"],"sec-resolveplural":["_ref_496","_ref_497","_ref_498"],"sec-Intl.RelativeTimeFormat":["_ref_500"],"sec-InitializeRelativeTimeFormat":["_ref_501","_ref_502","_ref_503","_ref_504","_ref_505","_ref_506","_ref_507","_ref_508","_ref_509","_ref_510","_ref_511","_ref_512"],"sec-Intl.RelativeTimeFormat.prototype":["_ref_513"],"sec-Intl.RelativeTimeFormat.supportedLocalesOf":["_ref_514","_ref_515","_ref_516"],"sec-Intl.RelativeTimeFormat.prototype.constructor":["_ref_517"],"sec-Intl.RelativeTimeFormat.prototype.format":["_ref_518"],"sec-Intl.RelativeTimeFormat.prototype.formatToParts":["_ref_519"],"sec-properties-of-intl-relativetimeformat-instances":["_ref_520"],"sec-PartitionRelativeTimePattern":["_ref_521","_ref_522","_ref_523","_ref_524","_ref_525"],"sec-makepartslist":["_ref_526","_ref_527"],"sec-FormatRelativeTime":["_ref_528"],"sec-FormatRelativeTimeToParts":["_ref_529"],"sec-intl.segmenter":["_ref_531","_ref_532","_ref_533","_ref_534","_ref_535","_ref_536","_ref_537","_ref_538"],"sec-intl.segmenter.prototype":["_ref_539"],"sec-intl.segmenter.supportedlocalesof":["_ref_540","_ref_541","_ref_542"],"sec-intl.segmenter.prototype.constructor":["_ref_543"],"sec-intl.segmenter.prototype.segment":["_ref_544"],"sec-properties-of-intl-segmenter-instances":["_ref_545"],"sec-createsegmentsobject":["_ref_546"],"sec-%segmentsprototype%.containing":["_ref_547","_ref_548","_ref_549"],"sec-%segmentsprototype%-@@iterator":["_ref_550"],"sec-properties-of-segments-instances":["_ref_551"],"sec-createsegmentiterator":["_ref_552"],"sec-%segmentiteratorprototype%.next":["_ref_553","_ref_554"],"sup-String.prototype.localeCompare":["_ref_556","_ref_557"],"sup-string.prototype.tolocalelowercase":["_ref_558"],"sup-string.prototype.tolocaleuppercase":["_ref_562"],"sup-number.prototype.tolocalestring":["_ref_563","_ref_564"],"sup-bigint.prototype.tolocalestring":["_ref_565","_ref_566"],"sup-date.prototype.tolocalestring":["_ref_567","_ref_568","_ref_569"],"sup-date.prototype.tolocaledatestring":["_ref_570","_ref_571","_ref_572"],"sup-date.prototype.tolocaletimestring":["_ref_573","_ref_574","_ref_575"]},"entries":[{"type":"term","term":"Internationalization Components for Unicode (ICU) library","id":"icu"},{"type":"clause","id":"introduction","titleHTML":"Introduction","number":""},{"type":"clause","id":"scope","titleHTML":"Scope","number":"1"},{"type":"clause","id":"conformance","titleHTML":"Conformance","number":"2","referencingIds":["_ref_120"]},{"type":"clause","id":"normative-references","titleHTML":"Normative References","number":"3"},{"type":"clause","id":"sec-internationalization-localization-globalization","titleHTML":"Internationalization, Localization, and Globalization","number":"4.1"},{"type":"clause","id":"sec-api-overview","titleHTML":"API Overview","number":"4.2"},{"type":"note","id":"legacy-constructor","number":1,"referencingIds":["_ref_43","_ref_55","_ref_57","_ref_69","_ref_86","_ref_92","_ref_94","_ref_99"]},{"type":"clause","id":"sec-api-conventions","titleHTML":"API Conventions","number":"4.3"},{"type":"clause","id":"sec-compatibility","titleHTML":"Compatibility across implementations","number":"4.4.1"},{"type":"clause","id":"sec-implementation-dependencies","titleHTML":"Implementation Dependencies","number":"4.4"},{"type":"clause","id":"overview","titleHTML":"Overview","number":"4"},{"type":"table","id":"table-402-well-known-intrinsic-objects","number":1,"caption":"Table 1: Well-known Intrinsic Objects (Extensions)"},{"type":"clause","id":"sec-402-well-known-intrinsic-objects","titleHTML":"Well-Known Intrinsic Objects","number":"5.1"},{"type":"clause","id":"conventions","titleHTML":"Notational Conventions","number":"5"},{"type":"term","term":"ASCII-uppercase","refId":"sec-case-sensitivity-and-case-mapping"},{"type":"term","term":"ASCII-lowercase","refId":"sec-case-sensitivity-and-case-mapping"},{"type":"term","term":"ASCII-case-insensitive match","refId":"sec-case-sensitivity-and-case-mapping"},{"type":"clause","id":"sec-case-sensitivity-and-case-mapping","titleHTML":"Case Sensitivity and Case Mapping","number":"6.1","referencingIds":["_ref_184","_ref_189","_ref_191","_ref_192","_ref_195","_ref_348","_ref_349","_ref_350","_ref_351","_ref_354","_ref_445"]},{"type":"term","term":"Unicode locale extension sequence","refId":"sec-unicode-locale-extension-sequences"},{"type":"clause","id":"sec-unicode-locale-extension-sequences","titleHTML":"Unicode Locale Extension Sequences","number":"6.2.1","referencingIds":["_ref_119","_ref_186","_ref_188","_ref_201","_ref_208","_ref_210","_ref_211","_ref_214","_ref_215","_ref_216","_ref_217","_ref_218","_ref_219","_ref_398","_ref_399"]},{"type":"op","aoid":"IsStructurallyValidLanguageTag","refId":"sec-isstructurallyvalidlanguagetag"},{"type":"clause","id":"sec-isstructurallyvalidlanguagetag","title":"IsStructurallyValidLanguageTag ( locale )","titleHTML":"IsStructurallyValidLanguageTag ( <var>locale</var> )","number":"6.2.2","referencingIds":["_ref_14","_ref_29","_ref_185","_ref_204","_ref_220","_ref_346","_ref_392"]},{"type":"op","aoid":"CanonicalizeUnicodeLocaleId","refId":"sec-canonicalizeunicodelocaleid"},{"type":"clause","id":"sec-canonicalizeunicodelocaleid","title":"CanonicalizeUnicodeLocaleId ( locale )","titleHTML":"CanonicalizeUnicodeLocaleId ( <var>locale</var> )","number":"6.2.3","referencingIds":["_ref_15","_ref_30","_ref_205","_ref_221","_ref_347","_ref_396","_ref_397"]},{"type":"op","aoid":"DefaultLocale","refId":"sec-defaultlocale"},{"type":"clause","id":"sec-defaultlocale","titleHTML":"DefaultLocale ( )","number":"6.2.4","referencingIds":["_ref_31","_ref_121","_ref_202","_ref_209","_ref_560"]},{"type":"clause","id":"sec-language-tags","titleHTML":"Language Tags","number":"6.2"},{"type":"op","aoid":"IsWellFormedCurrencyCode","refId":"sec-iswellformedcurrencycode"},{"type":"clause","id":"sec-iswellformedcurrencycode","title":"IsWellFormedCurrencyCode ( currency )","titleHTML":"IsWellFormedCurrencyCode ( <var>currency</var> )","number":"6.3.1","referencingIds":["_ref_353","_ref_439"]},{"type":"clause","id":"sec-currency-codes","titleHTML":"Currency Codes","number":"6.3","referencingIds":["_ref_90"]},{"type":"op","aoid":"IsValidTimeZoneName","refId":"sec-isvalidtimezonename"},{"type":"clause","id":"sec-isvalidtimezonename","title":"IsValidTimeZoneName ( timeZone )","titleHTML":"IsValidTimeZoneName ( <var>timeZone</var> )","number":"6.4.1","referencingIds":["_ref_16","_ref_194","_ref_278"]},{"type":"op","aoid":"CanonicalizeTimeZoneName","refId":"sec-canonicalizetimezonename"},{"type":"clause","id":"sec-canonicalizetimezonename","title":"CanonicalizeTimeZoneName ( timeZone )","titleHTML":"CanonicalizeTimeZoneName ( <var>timeZone</var> )","number":"6.4.2","referencingIds":["_ref_17","_ref_190","_ref_279"]},{"type":"op","aoid":"DefaultTimeZone","refId":"sec-defaulttimezone"},{"type":"clause","id":"sec-defaulttimezone","titleHTML":"DefaultTimeZone ( )","number":"6.4.3","referencingIds":["_ref_122","_ref_193","_ref_277"]},{"type":"clause","id":"sec-time-zone-names","titleHTML":"Time Zone Names","number":"6.4","referencingIds":["_ref_139"]},{"type":"op","aoid":"IsWellFormedUnitIdentifier","refId":"sec-iswellformedunitidentifier"},{"type":"clause","id":"sec-iswellformedunitidentifier","title":"IsWellFormedUnitIdentifier ( unitIdentifier )","titleHTML":"IsWellFormedUnitIdentifier ( <var>unitIdentifier</var> )","number":"6.5.1","referencingIds":["_ref_443"]},{"type":"table","id":"table-sanctioned-single-unit-identifiers","number":2,"caption":"Table 2: Single units sanctioned for use in ECMAScript","referencingIds":["_ref_18"]},{"type":"op","aoid":"IsSanctionedSingleUnitIdentifier","refId":"sec-issanctionedsingleunitidentifier"},{"type":"clause","id":"sec-issanctionedsingleunitidentifier","title":"IsSanctionedSingleUnitIdentifier ( unitIdentifier )","titleHTML":"IsSanctionedSingleUnitIdentifier ( <var>unitIdentifier</var> )","number":"6.5.2","referencingIds":["_ref_196","_ref_197","_ref_198"]},{"type":"clause","id":"sec-measurement-unit-identifiers","titleHTML":"Measurement Unit Identifiers","number":"6.5","referencingIds":["_ref_91"]},{"type":"clause","id":"locales-currencies-tz","titleHTML":"Identification of Locales, Currencies, Time Zones, and Measurement Units","number":"6"},{"type":"clause","id":"requirements","titleHTML":"Requirements for Standard Built-in ECMAScript Objects","number":"7"},{"type":"term","term":"%Intl%","refId":"intl-object"},{"type":"clause","id":"sec-Intl-toStringTag","titleHTML":"Intl[ @@toStringTag ]","number":"8.1.1","referencingIds":["_ref_168"]},{"type":"clause","id":"sec-value-properties-of-the-intl-object","titleHTML":"Value Properties of the Intl Object","number":"8.1"},{"type":"term","term":"service constructor","id":"service-constructor","referencingIds":["_ref_28","_ref_170","_ref_200","_ref_203","_ref_235","_ref_261","_ref_327","_ref_355","_ref_412","_ref_478","_ref_499","_ref_530"]},{"type":"clause","id":"sec-intl.collator-intro","titleHTML":"Intl.Collator ( . . . )","number":"8.2.1"},{"type":"clause","id":"sec-intl.datetimeformat-intro","titleHTML":"Intl.DateTimeFormat ( . . . )","number":"8.2.2"},{"type":"clause","id":"sec-intl.displaynames-intro","titleHTML":"Intl.DisplayNames ( . . . )","number":"8.2.3"},{"type":"clause","id":"sec-intl.listformat-intro","titleHTML":"Intl.ListFormat ( . . . )","number":"8.2.4"},{"type":"clause","id":"sec-intl.locale-intro","titleHTML":"Intl.Locale ( . . . )","number":"8.2.5"},{"type":"clause","id":"sec-intl.numberformat-intro","titleHTML":"Intl.NumberFormat ( . . . )","number":"8.2.6"},{"type":"clause","id":"sec-intl.pluralrules-intro","titleHTML":"Intl.PluralRules ( . . . )","number":"8.2.7"},{"type":"clause","id":"sec-intl.relativetimeformat-intro","titleHTML":"Intl.RelativeTimeFormat ( . . . )","number":"8.2.8"},{"type":"clause","id":"sec-intl.segmenter-intro","titleHTML":"Intl.Segmenter ( . . . )","number":"8.2.9"},{"type":"clause","id":"sec-constructor-properties-of-the-intl-object","titleHTML":"Constructor Properties of the Intl Object","number":"8.2","referencingIds":["_ref_2","_ref_13"]},{"type":"clause","id":"sec-intl.getcanonicallocales","title":"Intl.getCanonicalLocales ( locales )","titleHTML":"Intl.getCanonicalLocales ( <var>locales</var> )","number":"8.3.1"},{"type":"clause","id":"sec-function-properties-of-the-intl-object","titleHTML":"Function Properties of the Intl Object","number":"8.3"},{"type":"clause","id":"intl-object","titleHTML":"The Intl Object","number":"8","referencingIds":["_ref_6","_ref_177","_ref_265","_ref_326","_ref_416","_ref_472"]},{"type":"clause","id":"sec-internal-slots","titleHTML":"Internal slots of Service Constructors","number":"9.1","referencingIds":["_ref_34","_ref_35","_ref_36","_ref_37","_ref_42","_ref_46","_ref_47","_ref_70","_ref_75","_ref_76","_ref_81","_ref_82","_ref_83","_ref_85","_ref_88","_ref_89","_ref_104","_ref_105","_ref_106","_ref_110","_ref_111","_ref_112","_ref_114","_ref_115","_ref_116","_ref_123"]},{"type":"op","aoid":"CanonicalizeLocaleList","refId":"sec-canonicalizelocalelist"},{"type":"clause","id":"sec-canonicalizelocalelist","title":"CanonicalizeLocaleList ( locales )","titleHTML":"CanonicalizeLocaleList ( <var>locales</var> )","number":"9.2.1","referencingIds":["_ref_199","_ref_206","_ref_212","_ref_239","_ref_255","_ref_266","_ref_290","_ref_328","_ref_341","_ref_356","_ref_367","_ref_417","_ref_448","_ref_480","_ref_491","_ref_501","_ref_515","_ref_531","_ref_541","_ref_559"]},{"type":"op","aoid":"BestAvailableLocale","refId":"sec-bestavailablelocale"},{"type":"clause","id":"sec-bestavailablelocale","title":"BestAvailableLocale ( availableLocales, locale )","titleHTML":"BestAvailableLocale ( <var>availableLocales</var>, <var>locale</var> )","number":"9.2.2","referencingIds":["_ref_207","_ref_226","_ref_561"]},{"type":"op","aoid":"LookupMatcher","refId":"sec-lookupmatcher"},{"type":"clause","id":"sec-lookupmatcher","title":"LookupMatcher ( availableLocales, requestedLocales )","titleHTML":"LookupMatcher ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.3","referencingIds":["_ref_213","_ref_222"]},{"type":"op","aoid":"BestFitMatcher","refId":"sec-bestfitmatcher"},{"type":"clause","id":"sec-bestfitmatcher","title":"BestFitMatcher ( availableLocales, requestedLocales )","titleHTML":"BestFitMatcher ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.4","referencingIds":["_ref_124","_ref_223","_ref_576"]},{"type":"op","aoid":"UnicodeExtensionComponents","refId":"sec-unicode-extension-components"},{"type":"clause","id":"sec-unicode-extension-components","title":"UnicodeExtensionComponents ( extension )","titleHTML":"UnicodeExtensionComponents ( <var>extension</var> )","number":"9.2.5","referencingIds":["_ref_187","_ref_224","_ref_400"]},{"type":"op","aoid":"InsertUnicodeExtensionAndCanonicalize","refId":"sec-insert-unicode-extension-and-canonicalize"},{"type":"clause","id":"sec-insert-unicode-extension-and-canonicalize","title":"InsertUnicodeExtensionAndCanonicalize ( locale, extension )","titleHTML":"InsertUnicodeExtensionAndCanonicalize ( <var>locale</var>, <var>extension</var> )","number":"9.2.6","referencingIds":["_ref_225","_ref_401"]},{"type":"op","aoid":"ResolveLocale","refId":"sec-resolvelocale"},{"type":"clause","id":"sec-resolvelocale","title":"ResolveLocale ( availableLocales, requestedLocales, options, relevantExtensionKeys, localeData )","titleHTML":"ResolveLocale ( <var>availableLocales</var>, <var>requestedLocales</var>, <var>options</var>, <var>relevantExtensionKeys</var>, <var>localeData</var> )","number":"9.2.7","referencingIds":["_ref_32","_ref_249","_ref_274","_ref_332","_ref_360","_ref_422","_ref_486","_ref_506","_ref_535"]},{"type":"op","aoid":"LookupSupportedLocales","refId":"sec-lookupsupportedlocales"},{"type":"clause","id":"sec-lookupsupportedlocales","title":"LookupSupportedLocales ( availableLocales, requestedLocales )","titleHTML":"LookupSupportedLocales ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.8","referencingIds":["_ref_230"]},{"type":"op","aoid":"BestFitSupportedLocales","refId":"sec-bestfitsupportedlocales"},{"type":"clause","id":"sec-bestfitsupportedlocales","title":"BestFitSupportedLocales ( availableLocales, requestedLocales )","titleHTML":"BestFitSupportedLocales ( <var>availableLocales</var>, <var>requestedLocales</var> )","number":"9.2.9","referencingIds":["_ref_125","_ref_229","_ref_577"]},{"type":"op","aoid":"SupportedLocales","refId":"sec-supportedlocales"},{"type":"clause","id":"sec-supportedlocales","title":"SupportedLocales ( availableLocales, requestedLocales, options )","titleHTML":"SupportedLocales ( <var>availableLocales</var>, <var>requestedLocales</var>, <var>options</var> )","number":"9.2.10","referencingIds":["_ref_256","_ref_291","_ref_342","_ref_368","_ref_449","_ref_492","_ref_516","_ref_542"]},{"type":"op","aoid":"GetOptionsObject","refId":"sec-getoptionsobject"},{"type":"clause","id":"sec-getoptionsobject","title":"GetOptionsObject ( options )","titleHTML":"GetOptionsObject ( <var>options</var> )","number":"9.2.11","referencingIds":["_ref_233","_ref_329","_ref_357","_ref_532"]},{"type":"op","aoid":"CoerceOptionsToObject","refId":"sec-coerceoptionstoobject"},{"type":"clause","id":"sec-coerceoptionstoobject","title":"CoerceOptionsToObject ( options )","titleHTML":"CoerceOptionsToObject ( <var>options</var> )","number":"9.2.12","referencingIds":["_ref_227","_ref_240","_ref_383","_ref_418","_ref_481","_ref_502"]},{"type":"op","aoid":"GetOption","refId":"sec-getoption"},{"type":"clause","id":"sec-getoption","title":"GetOption ( options, property, type, values, default )","titleHTML":"GetOption ( <var>options</var>, <var>property</var>, <var>type</var>, <var>values</var>, <var>default</var> )","number":"9.2.13","referencingIds":["_ref_228","_ref_231","_ref_232","_ref_241","_ref_244","_ref_245","_ref_246","_ref_247","_ref_251","_ref_252","_ref_268","_ref_269","_ref_270","_ref_271","_ref_272","_ref_281","_ref_282","_ref_283","_ref_284","_ref_331","_ref_335","_ref_336","_ref_337","_ref_338","_ref_358","_ref_363","_ref_364","_ref_385","_ref_386","_ref_387","_ref_388","_ref_389","_ref_390","_ref_393","_ref_394","_ref_395","_ref_419","_ref_420","_ref_427","_ref_429","_ref_430","_ref_431","_ref_437","_ref_438","_ref_440","_ref_441","_ref_442","_ref_444","_ref_482","_ref_483","_ref_503","_ref_504","_ref_509","_ref_510","_ref_533","_ref_538"]},{"type":"op","aoid":"DefaultNumberOption","refId":"sec-defaultnumberoption"},{"type":"clause","id":"sec-defaultnumberoption","title":"DefaultNumberOption ( value, minimum, maximum, fallback )","titleHTML":"DefaultNumberOption ( <var>value</var>, <var>minimum</var>, <var>maximum</var>, <var>fallback</var> )","number":"9.2.14","referencingIds":["_ref_234","_ref_433","_ref_434","_ref_435","_ref_436"]},{"type":"op","aoid":"GetNumberOption","refId":"sec-getnumberoption"},{"type":"clause","id":"sec-getnumberoption","title":"GetNumberOption ( options, property, minimum, maximum, fallback )","titleHTML":"GetNumberOption ( <var>options</var>, <var>property</var>, <var>minimum</var>, <var>maximum</var>, <var>fallback</var> )","number":"9.2.15","referencingIds":["_ref_280","_ref_432"]},{"type":"op","aoid":"PartitionPattern","refId":"sec-partitionpattern"},{"type":"clause","id":"sec-partitionpattern","title":"PartitionPattern ( pattern )","titleHTML":"PartitionPattern ( <var>pattern</var> )","number":"9.2.16","referencingIds":["_ref_302","_ref_311","_ref_317","_ref_319","_ref_377","_ref_463","_ref_466","_ref_527"]},{"type":"clause","id":"sec-abstract-operations","titleHTML":"Abstract Operations","number":"9.2"},{"type":"clause","id":"locale-and-parameter-negotiation","titleHTML":"Locale and Parameter Negotiation","number":"9"},{"type":"term","term":"%Collator%","refId":"sec-the-intl-collator-constructor"},{"type":"clause","id":"sec-intl.collator","title":"Intl.Collator ( [ locales [ , options ] ] )","titleHTML":"Intl.Collator ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"10.1.1"},{"type":"op","aoid":"InitializeCollator","refId":"sec-initializecollator"},{"type":"clause","id":"sec-initializecollator","title":"InitializeCollator ( collator, locales, options )","titleHTML":"InitializeCollator ( <var>collator</var>, <var>locales</var>, <var>options</var> )","number":"10.1.2","referencingIds":["_ref_126","_ref_238"]},{"type":"clause","id":"sec-the-intl-collator-constructor","titleHTML":"The Intl.Collator Constructor","number":"10.1","referencingIds":["_ref_3","_ref_160","_ref_171","_ref_174","_ref_236","_ref_237","_ref_242","_ref_243","_ref_248","_ref_250","_ref_254","_ref_257","_ref_259","_ref_403","_ref_405","_ref_556"]},{"type":"clause","id":"sec-intl.collator.prototype","titleHTML":"Intl.Collator.prototype","number":"10.2.1"},{"type":"clause","id":"sec-intl.collator.supportedlocalesof","title":"Intl.Collator.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.Collator.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"10.2.2"},{"type":"clause","id":"sec-intl-collator-internal-slots","titleHTML":"Internal slots","number":"10.2.3","referencingIds":["_ref_127","_ref_128","_ref_129","_ref_130"]},{"type":"clause","id":"sec-properties-of-the-intl-collator-constructor","titleHTML":"Properties of the Intl.Collator Constructor","number":"10.2"},{"type":"term","term":"%Collator.prototype%","refId":"sec-properties-of-the-intl-collator-prototype-object"},{"type":"clause","id":"sec-intl.collator.prototype.constructor","titleHTML":"Intl.Collator.prototype.constructor","number":"10.3.1"},{"type":"clause","id":"sec-intl.collator.prototype-@@tostringtag","titleHTML":"Intl.Collator.prototype [ @@toStringTag ]","number":"10.3.2","referencingIds":["_ref_164"]},{"type":"clause","id":"sec-collator-compare-functions","titleHTML":"Collator Compare Functions","number":"10.3.3.1","referencingIds":["_ref_38","_ref_131"]},{"type":"table","id":"table-collator-comparestrings-sensitivity","number":3,"caption":"Table 3: Effects of Collator Sensitivity"},{"type":"op","aoid":"CompareStrings","refId":"sec-collator-comparestrings"},{"type":"clause","id":"sec-collator-comparestrings","title":"CompareStrings ( collator, x, y )","titleHTML":"CompareStrings ( <var>collator</var>, <var>x</var>, <var>y</var> )","number":"10.3.3.2","referencingIds":["_ref_258","_ref_557"]},{"type":"clause","id":"sec-intl.collator.prototype.compare","titleHTML":"get Intl.Collator.prototype.compare","number":"10.3.3","referencingIds":["_ref_41"]},{"type":"table","id":"table-collator-resolvedoptions-properties","number":4,"caption":"Table 4: Resolved Options of Collator Instances","referencingIds":["_ref_39","_ref_40"]},{"type":"clause","id":"sec-intl.collator.prototype.resolvedoptions","titleHTML":"Intl.Collator.prototype.resolvedOptions ( )","number":"10.3.4"},{"type":"clause","id":"sec-properties-of-the-intl-collator-prototype-object","titleHTML":"Properties of the Intl.Collator Prototype Object","number":"10.3","referencingIds":["_ref_253","_ref_260"]},{"type":"clause","id":"sec-properties-of-intl-collator-instances","titleHTML":"Properties of Intl.Collator Instances","number":"10.4"},{"type":"clause","id":"collator-objects","titleHTML":"Collator Objects","number":"10","referencingIds":["_ref_19"]},{"type":"term","term":"%DateTimeFormat%","refId":"sec-intl-datetimeformat-constructor"},{"type":"op","aoid":"ChainDateTimeFormat","refId":"sec-chaindatetimeformat"},{"type":"clause","id":"sec-chaindatetimeformat","title":"ChainDateTimeFormat ( dateTimeFormat, newTarget, this )","titleHTML":"ChainDateTimeFormat ( <var>dateTimeFormat</var>, <var>newTarget</var>, <var>this</var> )","number":"11.1.1.1","referencingIds":["_ref_263"]},{"type":"clause","id":"sec-intl.datetimeformat","title":"Intl.DateTimeFormat ( [ locales [ , options ] ] )","titleHTML":"Intl.DateTimeFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"11.1.1"},{"type":"op","aoid":"InitializeDateTimeFormat","refId":"sec-initializedatetimeformat"},{"type":"clause","id":"sec-initializedatetimeformat","title":"InitializeDateTimeFormat ( dateTimeFormat, locales, options )","titleHTML":"InitializeDateTimeFormat ( <var>dateTimeFormat</var>, <var>locales</var>, <var>options</var> )","number":"11.1.2","referencingIds":["_ref_132","_ref_262"]},{"type":"clause","id":"sec-intl-datetimeformat-constructor","titleHTML":"The Intl.DateTimeFormat Constructor","number":"11.1","referencingIds":["_ref_4","_ref_162","_ref_172","_ref_175","_ref_264","_ref_273","_ref_275","_ref_276","_ref_289","_ref_292","_ref_299","_ref_324","_ref_325","_ref_568","_ref_571","_ref_574"]},{"type":"clause","id":"sec-intl.datetimeformat.prototype","titleHTML":"Intl.DateTimeFormat.prototype","number":"11.2.1"},{"type":"clause","id":"sec-intl.datetimeformat.supportedlocalesof","title":"Intl.DateTimeFormat.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.DateTimeFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"11.2.2"},{"type":"table","id":"table-datetimeformat-rangepatternfields","number":5,"caption":"Table 5: Range pattern fields","referencingIds":["_ref_50","_ref_66"]},{"type":"clause","id":"sec-intl.datetimeformat-internal-slots","titleHTML":"Internal slots","number":"11.2.3","referencingIds":["_ref_33","_ref_61","_ref_62","_ref_133","_ref_134","_ref_135","_ref_136"]},{"type":"clause","id":"sec-properties-of-intl-datetimeformat-constructor","titleHTML":"Properties of the Intl.DateTimeFormat Constructor","number":"11.2"},{"type":"term","term":"%DateTimeFormat.prototype%","refId":"sec-properties-of-intl-datetimeformat-prototype-object"},{"type":"clause","id":"sec-intl.datetimeformat.prototype.constructor","titleHTML":"Intl.DateTimeFormat.prototype.constructor","number":"11.3.1"},{"type":"clause","id":"sec-intl.datetimeformat.prototype-@@tostringtag","titleHTML":"Intl.DateTimeFormat.prototype [ @@toStringTag ]","number":"11.3.2","referencingIds":["_ref_165"]},{"type":"clause","id":"sec-intl.datetimeformat.prototype.format","titleHTML":"get Intl.DateTimeFormat.prototype.format","number":"11.3.3","referencingIds":["_ref_63","_ref_163"]},{"type":"clause","id":"sec-Intl.DateTimeFormat.prototype.formatToParts","title":"Intl.DateTimeFormat.prototype.formatToParts ( date )","titleHTML":"Intl.DateTimeFormat.prototype.formatToParts ( <var>date</var> )","number":"11.3.4"},{"type":"clause","id":"sec-intl.datetimeformat.prototype.formatRange","title":"Intl.DateTimeFormat.prototype.formatRange ( startDate, endDate )","titleHTML":"Intl.DateTimeFormat.prototype.formatRange ( <var>startDate</var>, <var>endDate</var> )","number":"11.3.5"},{"type":"clause","id":"sec-Intl.DateTimeFormat.prototype.formatRangeToParts","title":"Intl.DateTimeFormat.prototype.formatRangeToParts ( startDate, endDate )","titleHTML":"Intl.DateTimeFormat.prototype.formatRangeToParts ( <var>startDate</var>, <var>endDate</var> )","number":"11.3.6"},{"type":"table","id":"table-datetimeformat-resolvedoptions-properties","number":6,"caption":"Table 6: Resolved Options of DateTimeFormat Instances","referencingIds":["_ref_58"]},{"type":"clause","id":"sec-intl.datetimeformat.prototype.resolvedoptions","titleHTML":"Intl.DateTimeFormat.prototype.resolvedOptions ( )","number":"11.3.7"},{"type":"clause","id":"sec-properties-of-intl-datetimeformat-prototype-object","titleHTML":"Properties of the Intl.DateTimeFormat Prototype Object","number":"11.3","referencingIds":["_ref_288","_ref_298"]},{"type":"clause","id":"sec-properties-of-intl-datetimeformat-instances","titleHTML":"Properties of Intl.DateTimeFormat Instances","number":"11.4"},{"type":"table","id":"table-datetimeformat-components","number":7,"caption":"Table 7: Components of date and time formats","referencingIds":["_ref_1","_ref_44","_ref_45","_ref_48","_ref_49","_ref_51","_ref_52","_ref_53","_ref_54","_ref_59","_ref_60","_ref_64","_ref_65"]},{"type":"op","aoid":"ToDateTimeOptions","refId":"sec-todatetimeoptions"},{"type":"clause","id":"sec-todatetimeoptions","title":"ToDateTimeOptions ( options, required, defaults )","titleHTML":"ToDateTimeOptions ( <var>options</var>, <var>required</var>, <var>defaults</var> )","number":"11.5.1","referencingIds":["_ref_267","_ref_567","_ref_570","_ref_573"]},{"type":"op","aoid":"DateTimeStyleFormat","refId":"sec-date-time-style-format"},{"type":"clause","id":"sec-date-time-style-format","title":"DateTimeStyleFormat ( dateStyle, timeStyle, styles )","titleHTML":"DateTimeStyleFormat ( <var>dateStyle</var>, <var>timeStyle</var>, <var>styles</var> )","number":"11.5.2","referencingIds":["_ref_285"]},{"type":"op","aoid":"BasicFormatMatcher","refId":"sec-basicformatmatcher"},{"type":"clause","id":"sec-basicformatmatcher","title":"BasicFormatMatcher ( options, formats )","titleHTML":"BasicFormatMatcher ( <var>options</var>, <var>formats</var> )","number":"11.5.3","referencingIds":["_ref_286","_ref_300"]},{"type":"op","aoid":"BestFitFormatMatcher","refId":"sec-bestfitformatmatcher"},{"type":"clause","id":"sec-bestfitformatmatcher","title":"BestFitFormatMatcher ( options, formats )","titleHTML":"BestFitFormatMatcher ( <var>options</var>, <var>formats</var> )","number":"11.5.4","referencingIds":["_ref_287","_ref_578"]},{"type":"clause","id":"sec-datetime-format-functions","titleHTML":"DateTime Format Functions","number":"11.5.5","referencingIds":["_ref_56"]},{"type":"op","aoid":"FormatDateTimePattern","refId":"sec-formatdatetimepattern"},{"type":"clause","id":"sec-formatdatetimepattern","title":"FormatDateTimePattern ( dateTimeFormat, patternParts, x, rangeFormatOptions )","titleHTML":"FormatDateTimePattern ( <var>dateTimeFormat</var>, <var>patternParts</var>, <var>x</var>, <var>rangeFormatOptions</var> )","number":"11.5.6","referencingIds":["_ref_312","_ref_318","_ref_320"]},{"type":"op","aoid":"PartitionDateTimePattern","refId":"sec-partitiondatetimepattern"},{"type":"clause","id":"sec-partitiondatetimepattern","title":"PartitionDateTimePattern ( dateTimeFormat, x )","titleHTML":"PartitionDateTimePattern ( <var>dateTimeFormat</var>, <var>x</var> )","number":"11.5.7","referencingIds":["_ref_313","_ref_314"]},{"type":"op","aoid":"FormatDateTime","refId":"sec-formatdatetime"},{"type":"clause","id":"sec-formatdatetime","title":"FormatDateTime ( dateTimeFormat, x )","titleHTML":"FormatDateTime ( <var>dateTimeFormat</var>, <var>x</var> )","number":"11.5.8","referencingIds":["_ref_137","_ref_138","_ref_301","_ref_569","_ref_572","_ref_575"]},{"type":"op","aoid":"FormatDateTimeToParts","refId":"sec-formatdatetimetoparts"},{"type":"clause","id":"sec-formatdatetimetoparts","title":"FormatDateTimeToParts ( dateTimeFormat, x )","titleHTML":"FormatDateTimeToParts ( <var>dateTimeFormat</var>, <var>x</var> )","number":"11.5.9","referencingIds":["_ref_294"]},{"type":"op","aoid":"PartitionDateTimeRangePattern","refId":"sec-partitiondatetimerangepattern"},{"type":"clause","id":"sec-partitiondatetimerangepattern","title":"PartitionDateTimeRangePattern ( dateTimeFormat, x, y )","titleHTML":"PartitionDateTimeRangePattern ( <var>dateTimeFormat</var>, <var>x</var>, <var>y</var> )","number":"11.5.10","referencingIds":["_ref_321","_ref_322"]},{"type":"op","aoid":"FormatDateTimeRange","refId":"sec-formatdatetimerange"},{"type":"clause","id":"sec-formatdatetimerange","title":"FormatDateTimeRange ( dateTimeFormat, x, y )","titleHTML":"FormatDateTimeRange ( <var>dateTimeFormat</var>, <var>x</var>, <var>y</var> )","number":"11.5.11","referencingIds":["_ref_295"]},{"type":"op","aoid":"FormatDateTimeRangeToParts","refId":"sec-formatdatetimerangetoparts"},{"type":"clause","id":"sec-formatdatetimerangetoparts","title":"FormatDateTimeRangeToParts ( dateTimeFormat, x, y )","titleHTML":"FormatDateTimeRangeToParts ( <var>dateTimeFormat</var>, <var>x</var>, <var>y</var> )","number":"11.5.12","referencingIds":["_ref_296"]},{"type":"table","id":"table-datetimeformat-tolocaltime-record","number":8,"caption":"Table 8: Record returned by ToLocalTime","referencingIds":["_ref_67","_ref_68"]},{"type":"op","aoid":"ToLocalTime","refId":"sec-tolocaltime"},{"type":"clause","id":"sec-tolocaltime","title":"ToLocalTime ( t, calendar, timeZone )","titleHTML":"ToLocalTime ( <var>t</var>, <var>calendar</var>, <var>timeZone</var> )","number":"11.5.13","referencingIds":["_ref_306","_ref_315","_ref_316","_ref_323"]},{"type":"op","aoid":"UnwrapDateTimeFormat","refId":"sec-unwrapdatetimeformat"},{"type":"clause","id":"sec-unwrapdatetimeformat","title":"UnwrapDateTimeFormat ( dtf )","titleHTML":"UnwrapDateTimeFormat ( <var>dtf</var> )","number":"11.5.14","referencingIds":["_ref_293","_ref_297"]},{"type":"clause","id":"sec-datetimeformat-abstracts","titleHTML":"Abstract Operations for DateTimeFormat Objects","number":"11.5"},{"type":"clause","id":"datetimeformat-objects","titleHTML":"DateTimeFormat Objects","number":"11","referencingIds":["_ref_20"]},{"type":"term","term":"%DisplayNames%","refId":"sec-intl-displaynames-constructor"},{"type":"clause","id":"sec-Intl.DisplayNames","title":"Intl.DisplayNames ( locales, options )","titleHTML":"Intl.DisplayNames ( <var>locales</var>, <var>options</var> )","number":"12.1.1"},{"type":"clause","id":"sec-intl-displaynames-constructor","titleHTML":"The Intl.DisplayNames Constructor","number":"12.1","referencingIds":["_ref_5","_ref_176","_ref_330","_ref_333","_ref_334","_ref_340","_ref_343"]},{"type":"clause","id":"sec-Intl.DisplayNames.prototype","titleHTML":"Intl.DisplayNames.prototype","number":"12.2.1"},{"type":"clause","id":"sec-Intl.DisplayNames.supportedLocalesOf","title":"Intl.DisplayNames.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.DisplayNames.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"12.2.2"},{"type":"clause","id":"sec-Intl.DisplayNames-internal-slots","titleHTML":"Internal slots","number":"12.2.3","referencingIds":["_ref_71","_ref_72","_ref_73","_ref_74","_ref_79","_ref_140"]},{"type":"clause","id":"sec-properties-of-intl-displaynames-constructor","titleHTML":"Properties of the Intl.DisplayNames Constructor","number":"12.2"},{"type":"term","term":"%DisplayNames.prototype%","refId":"sec-properties-of-intl-displaynames-prototype-object"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype.constructor","titleHTML":"Intl.DisplayNames.prototype.constructor","number":"12.3.1"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype-@@tostringtag","titleHTML":"Intl.DisplayNames.prototype[ @@toStringTag ]","number":"12.3.2"},{"type":"op","aoid":"Intl.DisplayNames.prototype.of","refId":"sec-Intl.DisplayNames.prototype.of"},{"type":"clause","id":"sec-Intl.DisplayNames.prototype.of","title":"Intl.DisplayNames.prototype.of ( code )","titleHTML":"Intl.DisplayNames.prototype.of ( <var>code</var> )","number":"12.3.3"},{"type":"table","id":"table-displaynames-resolvedoptions-properties","number":9,"caption":"Table 9: Resolved Options of DisplayNames Instances","referencingIds":["_ref_78"]},{"type":"clause","id":"sec-Intl.DisplayNames.prototype.resolvedOptions","titleHTML":"Intl.DisplayNames.prototype.resolvedOptions ( )","number":"12.3.4"},{"type":"clause","id":"sec-properties-of-intl-displaynames-prototype-object","titleHTML":"Properties of the Intl.DisplayNames Prototype Object","number":"12.3","referencingIds":["_ref_339","_ref_345"]},{"type":"clause","id":"sec-properties-of-intl-displaynames-instances","titleHTML":"Properties of Intl.DisplayNames Instances","number":"12.4"},{"type":"op","aoid":"CanonicalCodeForDisplayNames","refId":"sec-canonicalcodefordisplaynames"},{"type":"clause","id":"sec-canonicalcodefordisplaynames","title":"CanonicalCodeForDisplayNames ( type, code )","titleHTML":"CanonicalCodeForDisplayNames ( <var>type</var>, <var>code</var> )","number":"12.5.1","referencingIds":["_ref_344"]},{"type":"table","id":"table-validcodefordatetimefield","number":10,"caption":"Table 10: Codes For Date Time Field of DisplayNames","referencingIds":["_ref_77","_ref_80"]},{"type":"op","aoid":"IsValidDateTimeFieldCode","refId":"sec-isvaliddatetimefieldcode"},{"type":"clause","id":"sec-isvaliddatetimefieldcode","title":"IsValidDateTimeFieldCode ( field )","titleHTML":"IsValidDateTimeFieldCode ( <var>field</var> )","number":"12.5.2","referencingIds":["_ref_352"]},{"type":"clause","id":"sec-intl-displaynames-abstracts","titleHTML":"Abstract Operations for DisplayNames Objects","number":"12.5"},{"type":"clause","id":"intl-displaynames-objects","titleHTML":"DisplayNames Objects","number":"12","referencingIds":["_ref_21"]},{"type":"term","term":"%ListFormat%","refId":"sec-intl-listformat-constructor"},{"type":"clause","id":"sec-Intl.ListFormat","title":"Intl.ListFormat ( [ locales [ , options ] ] )","titleHTML":"Intl.ListFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"13.1.1"},{"type":"clause","id":"sec-intl-listformat-constructor","titleHTML":"The Intl.ListFormat Constructor","number":"13.1","referencingIds":["_ref_7","_ref_178","_ref_359","_ref_361","_ref_362","_ref_366","_ref_369","_ref_370"]},{"type":"clause","id":"sec-Intl.ListFormat.prototype","titleHTML":"Intl.ListFormat.prototype","number":"13.2.1"},{"type":"clause","id":"sec-Intl.ListFormat.supportedLocalesOf","title":"Intl.ListFormat.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.ListFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"13.2.2"},{"type":"term","term":"ListFormat template set","refId":"sec-Intl.ListFormat-internal-slots"},{"type":"clause","id":"sec-Intl.ListFormat-internal-slots","titleHTML":"Internal slots","number":"13.2.3","referencingIds":["_ref_141","_ref_376"]},{"type":"clause","id":"sec-properties-of-intl-listformat-constructor","titleHTML":"Properties of the Intl.ListFormat Constructor","number":"13.2"},{"type":"term","term":"%ListFormat.prototype%","refId":"sec-properties-of-intl-listformat-prototype-object"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.constructor","titleHTML":"Intl.ListFormat.prototype.constructor","number":"13.3.1"},{"type":"clause","id":"sec-Intl.ListFormat.prototype-toStringTag","titleHTML":"Intl.ListFormat.prototype [ @@toStringTag ]","number":"13.3.2"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.format","title":"Intl.ListFormat.prototype.format ( list )","titleHTML":"Intl.ListFormat.prototype.format ( <var>list</var> )","number":"13.3.3"},{"type":"clause","id":"sec-Intl.ListFormat.prototype.formatToParts","title":"Intl.ListFormat.prototype.formatToParts ( list )","titleHTML":"Intl.ListFormat.prototype.formatToParts ( <var>list</var> )","number":"13.3.4"},{"type":"table","id":"table-listformat-resolvedoptions-properties","number":11,"caption":"Table 11: Resolved Options of ListFormat Instances","referencingIds":["_ref_84"]},{"type":"clause","id":"sec-Intl.ListFormat.prototype.resolvedoptions","titleHTML":"Intl.ListFormat.prototype.resolvedOptions ( )","number":"13.3.5"},{"type":"clause","id":"sec-properties-of-intl-listformat-prototype-object","titleHTML":"Properties of the Intl.ListFormat Prototype Object","number":"13.3","referencingIds":["_ref_365","_ref_375"]},{"type":"clause","id":"sec-properties-of-intl-listformat-instances","titleHTML":"Properties of Intl.ListFormat Instances","number":"13.4"},{"type":"op","aoid":"DeconstructPattern","refId":"sec-deconstructpattern"},{"type":"clause","id":"sec-deconstructpattern","title":"DeconstructPattern ( pattern, placeables )","titleHTML":"DeconstructPattern ( <var>pattern</var>, <var>placeables</var> )","number":"13.5.1","referencingIds":["_ref_378","_ref_379"]},{"type":"op","aoid":"CreatePartsFromList","refId":"sec-createpartsfromlist"},{"type":"clause","id":"sec-createpartsfromlist","title":"CreatePartsFromList ( listFormat, list )","titleHTML":"CreatePartsFromList ( <var>listFormat</var>, <var>list</var> )","number":"13.5.2","referencingIds":["_ref_380","_ref_381"]},{"type":"op","aoid":"FormatList","refId":"sec-formatlist"},{"type":"clause","id":"sec-formatlist","title":"FormatList ( listFormat, list )","titleHTML":"FormatList ( <var>listFormat</var>, <var>list</var> )","number":"13.5.3","referencingIds":["_ref_372"]},{"type":"op","aoid":"FormatListToParts","refId":"sec-formatlisttoparts"},{"type":"clause","id":"sec-formatlisttoparts","title":"FormatListToParts ( listFormat, list )","titleHTML":"FormatListToParts ( <var>listFormat</var>, <var>list</var> )","number":"13.5.4","referencingIds":["_ref_374"]},{"type":"op","aoid":"StringListFromIterable","refId":"sec-createstringlistfromiterable"},{"type":"clause","id":"sec-createstringlistfromiterable","title":"StringListFromIterable ( iterable )","titleHTML":"StringListFromIterable ( <var>iterable</var> )","number":"13.5.5","referencingIds":["_ref_371","_ref_373"]},{"type":"clause","id":"sec-intl-listformat-abstracts","titleHTML":"Abstract Operations for ListFormat Objects","number":"13.5"},{"type":"clause","id":"listformat-objects","titleHTML":"ListFormat Objects","number":"13","referencingIds":["_ref_22"]},{"type":"term","term":"%Locale%","refId":"sec-intl-locale-constructor"},{"type":"clause","id":"sec-Intl.Locale","title":"Intl.Locale ( tag [ , options ] )","titleHTML":"Intl.Locale ( <var>tag</var> [ , <var>options</var> ] )","number":"14.1.1","referencingIds":["_ref_142"]},{"type":"op","aoid":"ApplyOptionsToTag","refId":"sec-apply-options-to-tag"},{"type":"clause","id":"sec-apply-options-to-tag","title":"ApplyOptionsToTag ( tag, options )","titleHTML":"ApplyOptionsToTag ( <var>tag</var>, <var>options</var> )","number":"14.1.2","referencingIds":["_ref_384"]},{"type":"op","aoid":"ApplyUnicodeExtensionToTag","refId":"sec-apply-unicode-extension-to-tag"},{"type":"clause","id":"sec-apply-unicode-extension-to-tag","title":"ApplyUnicodeExtensionToTag ( tag, options, relevantExtensionKeys )","titleHTML":"ApplyUnicodeExtensionToTag ( <var>tag</var>, <var>options</var>, <var>relevantExtensionKeys</var> )","number":"14.1.3","referencingIds":["_ref_391"]},{"type":"clause","id":"sec-intl-locale-constructor","titleHTML":"The Intl.Locale Constructor","number":"14.1","referencingIds":["_ref_8","_ref_179","_ref_382","_ref_404","_ref_406","_ref_407","_ref_408","_ref_409","_ref_410","_ref_411"]},{"type":"clause","id":"sec-Intl.Locale.prototype","titleHTML":"Intl.Locale.prototype","number":"14.2.1"},{"type":"clause","id":"sec-intl.locale-internal-slots","titleHTML":"Internal slots","number":"14.2.2"},{"type":"clause","id":"sec-properties-of-intl-locale-constructor","titleHTML":"Properties of the Intl.Locale Constructor","number":"14.2"},{"type":"term","term":"%Locale.prototype%","refId":"sec-properties-of-intl-locale-prototype-object"},{"type":"clause","id":"sec-Intl.Locale.prototype.constructor","titleHTML":"Intl.Locale.prototype.constructor","number":"14.3.1"},{"type":"clause","id":"sec-Intl.Locale.prototype-@@tostringtag","titleHTML":"Intl.Locale.prototype[ @@toStringTag ]","number":"14.3.2"},{"type":"clause","id":"sec-Intl.Locale.prototype.maximize","titleHTML":"Intl.Locale.prototype.maximize ( )","number":"14.3.3"},{"type":"clause","id":"sec-Intl.Locale.prototype.minimize","titleHTML":"Intl.Locale.prototype.minimize ( )","number":"14.3.4"},{"type":"clause","id":"sec-Intl.Locale.prototype.toString","titleHTML":"Intl.Locale.prototype.toString ( )","number":"14.3.5"},{"type":"clause","id":"sec-Intl.Locale.prototype.baseName","titleHTML":"get Intl.Locale.prototype.baseName","number":"14.3.6"},{"type":"clause","id":"sec-Intl.Locale.prototype.calendar","titleHTML":"get Intl.Locale.prototype.calendar","number":"14.3.7"},{"type":"clause","id":"sec-Intl.Locale.prototype.caseFirst","titleHTML":"get Intl.Locale.prototype.caseFirst","number":"14.3.8"},{"type":"clause","id":"sec-Intl.Locale.prototype.collation","titleHTML":"get Intl.Locale.prototype.collation","number":"14.3.9"},{"type":"clause","id":"sec-Intl.Locale.prototype.hourCycle","titleHTML":"get Intl.Locale.prototype.hourCycle","number":"14.3.10"},{"type":"clause","id":"sec-Intl.Locale.prototype.numeric","titleHTML":"get Intl.Locale.prototype.numeric","number":"14.3.11"},{"type":"clause","id":"sec-Intl.Locale.prototype.numberingSystem","titleHTML":"get Intl.Locale.prototype.numberingSystem","number":"14.3.12"},{"type":"clause","id":"sec-Intl.Locale.prototype.language","titleHTML":"get Intl.Locale.prototype.language","number":"14.3.13"},{"type":"clause","id":"sec-Intl.Locale.prototype.script","titleHTML":"get Intl.Locale.prototype.script","number":"14.3.14"},{"type":"clause","id":"sec-Intl.Locale.prototype.region","titleHTML":"get Intl.Locale.prototype.region","number":"14.3.15"},{"type":"clause","id":"sec-properties-of-intl-locale-prototype-object","titleHTML":"Properties of the Intl.Locale Prototype Object","number":"14.3","referencingIds":["_ref_402"]},{"type":"clause","id":"locale-objects","titleHTML":"Locale Objects","number":"14","referencingIds":["_ref_23"]},{"type":"term","term":"%NumberFormat%","refId":"sec-intl-numberformat-constructor"},{"type":"op","aoid":"ChainNumberFormat","refId":"sec-chainnumberformat"},{"type":"clause","id":"sec-chainnumberformat","title":"ChainNumberFormat ( numberFormat, newTarget, this )","titleHTML":"ChainNumberFormat ( <var>numberFormat</var>, <var>newTarget</var>, <var>this</var> )","number":"15.1.1.1","referencingIds":["_ref_414"]},{"type":"clause","id":"sec-intl.numberformat","title":"Intl.NumberFormat ( [ locales [ , options ] ] )","titleHTML":"Intl.NumberFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"15.1.1"},{"type":"op","aoid":"InitializeNumberFormat","refId":"sec-initializenumberformat"},{"type":"clause","id":"sec-initializenumberformat","title":"InitializeNumberFormat ( numberFormat, locales, options )","titleHTML":"InitializeNumberFormat ( <var>numberFormat</var>, <var>locales</var>, <var>options</var> )","number":"15.1.2","referencingIds":["_ref_413"]},{"type":"op","aoid":"SetNumberFormatDigitOptions","refId":"sec-setnfdigitoptions"},{"type":"clause","id":"sec-setnfdigitoptions","title":"SetNumberFormatDigitOptions ( intlObj, options, mnfdDefault, mxfdDefault, notation )","titleHTML":"SetNumberFormatDigitOptions ( <var>intlObj</var>, <var>options</var>, <var>mnfdDefault</var>, <var>mxfdDefault</var>, <var>notation</var> )","number":"15.1.3","referencingIds":["_ref_428","_ref_484"]},{"type":"op","aoid":"SetNumberFormatUnitOptions","refId":"sec-setnumberformatunitoptions"},{"type":"clause","id":"sec-setnumberformatunitoptions","title":"SetNumberFormatUnitOptions ( intlObj, options )","titleHTML":"SetNumberFormatUnitOptions ( <var>intlObj</var>, <var>options</var> )","number":"15.1.4","referencingIds":["_ref_425"]},{"type":"clause","id":"sec-intl-numberformat-constructor","titleHTML":"The Intl.NumberFormat Constructor","number":"15.1","referencingIds":["_ref_9","_ref_161","_ref_169","_ref_173","_ref_180","_ref_303","_ref_304","_ref_305","_ref_415","_ref_421","_ref_423","_ref_424","_ref_447","_ref_450","_ref_470","_ref_471","_ref_473","_ref_474","_ref_511","_ref_563","_ref_565"]},{"type":"clause","id":"sec-intl.numberformat.prototype","titleHTML":"Intl.NumberFormat.prototype","number":"15.2.1"},{"type":"clause","id":"sec-intl.numberformat.supportedlocalesof","title":"Intl.NumberFormat.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.NumberFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"15.2.2"},{"type":"clause","id":"sec-intl.numberformat-internal-slots","titleHTML":"Internal slots","number":"15.2.3","referencingIds":["_ref_100","_ref_101","_ref_102","_ref_103","_ref_143"]},{"type":"clause","id":"sec-properties-of-intl-numberformat-constructor","titleHTML":"Properties of the Intl.NumberFormat Constructor","number":"15.2"},{"type":"term","term":"%NumberFormat.prototype%","refId":"sec-properties-of-intl-numberformat-prototype-object"},{"type":"clause","id":"sec-intl.numberformat.prototype.constructor","titleHTML":"Intl.NumberFormat.prototype.constructor","number":"15.3.1"},{"type":"clause","id":"sec-intl.numberformat.prototype-@@tostringtag","titleHTML":"Intl.NumberFormat.prototype [ @@toStringTag ]","number":"15.3.2","referencingIds":["_ref_166"]},{"type":"clause","id":"sec-intl.numberformat.prototype.format","titleHTML":"get Intl.NumberFormat.prototype.format","number":"15.3.3","referencingIds":["_ref_96"]},{"type":"clause","id":"sec-intl.numberformat.prototype.formattoparts","title":"Intl.NumberFormat.prototype.formatToParts ( value )","titleHTML":"Intl.NumberFormat.prototype.formatToParts ( <var>value</var> )","number":"15.3.4"},{"type":"table","id":"table-numberformat-resolvedoptions-properties","number":12,"caption":"Table 12: Resolved Options of NumberFormat Instances","referencingIds":["_ref_95"]},{"type":"clause","id":"sec-intl.numberformat.prototype.resolvedoptions","titleHTML":"Intl.NumberFormat.prototype.resolvedOptions ( )","number":"15.3.5"},{"type":"clause","id":"sec-properties-of-intl-numberformat-prototype-object","titleHTML":"Properties of the Intl.NumberFormat Prototype Object","number":"15.3","referencingIds":["_ref_446","_ref_454"]},{"type":"clause","id":"sec-properties-of-intl-numberformat-instances","titleHTML":"Properties of Intl.NumberFormat Instances","number":"15.4","referencingIds":["_ref_109"]},{"type":"op","aoid":"CurrencyDigits","refId":"sec-currencydigits"},{"type":"clause","id":"sec-currencydigits","title":"CurrencyDigits ( currency )","titleHTML":"CurrencyDigits ( <var>currency</var> )","number":"15.5.1","referencingIds":["_ref_426"]},{"type":"clause","id":"sec-number-format-functions","titleHTML":"Number Format Functions","number":"15.5.2","referencingIds":["_ref_93"]},{"type":"op","aoid":"FormatNumericToString","refId":"sec-formatnumberstring"},{"type":"clause","id":"sec-formatnumberstring","title":"FormatNumericToString ( intlObject, x )","titleHTML":"FormatNumericToString ( <var>intlObject</var>, <var>x</var> )","number":"15.5.3","referencingIds":["_ref_87","_ref_461","_ref_476","_ref_496"]},{"type":"op","aoid":"PartitionNumberPattern","refId":"sec-partitionnumberpattern"},{"type":"clause","id":"sec-partitionnumberpattern","title":"PartitionNumberPattern ( numberFormat, x )","titleHTML":"PartitionNumberPattern ( <var>numberFormat</var>, <var>x</var> )","number":"15.5.4","referencingIds":["_ref_468","_ref_469","_ref_523"]},{"type":"table","id":"table-numbering-system-digits","number":13,"caption":"Table 13: Numbering systems with simple digit mappings","referencingIds":["_ref_97","_ref_98","_ref_146"]},{"type":"op","aoid":"PartitionNotationSubPattern","refId":"sec-partitionnotationsubpattern"},{"type":"clause","id":"sec-partitionnotationsubpattern","title":"PartitionNotationSubPattern ( numberFormat, x, n, exponent )","titleHTML":"PartitionNotationSubPattern ( <var>numberFormat</var>, <var>x</var>, <var>n</var>, <var>exponent</var> )","number":"15.5.5","referencingIds":["_ref_464"]},{"type":"op","aoid":"FormatNumeric","refId":"sec-formatnumber"},{"type":"clause","id":"sec-formatnumber","title":"FormatNumeric ( numberFormat, x )","titleHTML":"FormatNumeric ( <var>numberFormat</var>, <var>x</var> )","number":"15.5.6","referencingIds":["_ref_144","_ref_145","_ref_147","_ref_148","_ref_149","_ref_150","_ref_151","_ref_152","_ref_153","_ref_154","_ref_307","_ref_308","_ref_309","_ref_310","_ref_455","_ref_564","_ref_566"]},{"type":"op","aoid":"FormatNumericToParts","refId":"sec-formatnumbertoparts"},{"type":"clause","id":"sec-formatnumbertoparts","title":"FormatNumericToParts ( numberFormat, x )","titleHTML":"FormatNumericToParts ( <var>numberFormat</var>, <var>x</var> )","number":"15.5.7","referencingIds":["_ref_452"]},{"type":"op","aoid":"ToRawPrecision","refId":"sec-torawprecision"},{"type":"clause","id":"sec-torawprecision","title":"ToRawPrecision ( x, minPrecision, maxPrecision )","titleHTML":"ToRawPrecision ( <var>x</var>, <var>minPrecision</var>, <var>maxPrecision</var> )","number":"15.5.8","referencingIds":["_ref_456","_ref_458"]},{"type":"op","aoid":"ToRawFixed","refId":"sec-torawfixed"},{"type":"clause","id":"sec-torawfixed","title":"ToRawFixed ( x, minInteger, minFraction, maxFraction )","titleHTML":"ToRawFixed ( <var>x</var>, <var>minInteger</var>, <var>minFraction</var>, <var>maxFraction</var> )","number":"15.5.9","referencingIds":["_ref_457","_ref_459","_ref_467"]},{"type":"op","aoid":"UnwrapNumberFormat","refId":"sec-unwrapnumberformat"},{"type":"clause","id":"sec-unwrapnumberformat","title":"UnwrapNumberFormat ( nf )","titleHTML":"UnwrapNumberFormat ( <var>nf</var> )","number":"15.5.10","referencingIds":["_ref_451","_ref_453"]},{"type":"op","aoid":"GetNumberFormatPattern","refId":"sec-getnumberformatpattern"},{"type":"clause","id":"sec-getnumberformatpattern","title":"GetNumberFormatPattern ( numberFormat, x )","titleHTML":"GetNumberFormatPattern ( <var>numberFormat</var>, <var>x</var> )","number":"15.5.11","referencingIds":["_ref_462"]},{"type":"op","aoid":"GetNotationSubPattern","refId":"sec-getnotationsubpattern"},{"type":"clause","id":"sec-getnotationsubpattern","title":"GetNotationSubPattern ( numberFormat, exponent )","titleHTML":"GetNotationSubPattern ( <var>numberFormat</var>, <var>exponent</var> )","number":"15.5.12","referencingIds":["_ref_465"]},{"type":"op","aoid":"ComputeExponent","refId":"sec-computeexponent"},{"type":"clause","id":"sec-computeexponent","title":"ComputeExponent ( numberFormat, x )","titleHTML":"ComputeExponent ( <var>numberFormat</var>, <var>x</var> )","number":"15.5.13","referencingIds":["_ref_460"]},{"type":"op","aoid":"ComputeExponentForMagnitude","refId":"sec-computeexponentformagnitude"},{"type":"clause","id":"sec-computeexponentformagnitude","title":"ComputeExponentForMagnitude ( numberFormat, magnitude )","titleHTML":"ComputeExponentForMagnitude ( <var>numberFormat</var>, <var>magnitude</var> )","number":"15.5.14","referencingIds":["_ref_475","_ref_477"]},{"type":"clause","id":"sec-numberformat-abstracts","titleHTML":"Abstract Operations for NumberFormat Objects","number":"15.5"},{"type":"clause","id":"numberformat-objects","titleHTML":"NumberFormat Objects","number":"15","referencingIds":["_ref_24"]},{"type":"term","term":"%PluralRules%","refId":"sec-intl-pluralrules-constructor"},{"type":"clause","id":"sec-intl.pluralrules","title":"Intl.PluralRules ( [ locales [ , options ] ] )","titleHTML":"Intl.PluralRules ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"16.1.1"},{"type":"op","aoid":"InitializePluralRules","refId":"sec-initializepluralrules"},{"type":"clause","id":"sec-initializepluralrules","title":"InitializePluralRules ( pluralRules, locales, options )","titleHTML":"InitializePluralRules ( <var>pluralRules</var>, <var>locales</var>, <var>options</var> )","number":"16.1.2","referencingIds":["_ref_155","_ref_479"]},{"type":"clause","id":"sec-intl-pluralrules-constructor","titleHTML":"The Intl.PluralRules Constructor","number":"16.1","referencingIds":["_ref_10","_ref_181","_ref_485","_ref_487","_ref_488","_ref_490","_ref_493","_ref_512"]},{"type":"clause","id":"sec-intl.pluralrules.prototype","titleHTML":"Intl.PluralRules.prototype","number":"16.2.1"},{"type":"clause","id":"sec-intl.pluralrules.supportedlocalesof","title":"Intl.PluralRules.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.PluralRules.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"16.2.2"},{"type":"clause","id":"sec-intl.pluralrules-internal-slots","titleHTML":"Internal slots","number":"16.2.3"},{"type":"clause","id":"sec-properties-of-intl-pluralrules-constructor","titleHTML":"Properties of the Intl.PluralRules Constructor","number":"16.2"},{"type":"term","term":"%PluralRules.prototype%","refId":"sec-properties-of-intl-pluralrules-prototype-object"},{"type":"clause","id":"sec-intl.pluralrules.prototype.constructor","titleHTML":"Intl.PluralRules.prototype.constructor","number":"16.3.1"},{"type":"clause","id":"sec-intl.pluralrules.prototype-tostringtag","titleHTML":"Intl.PluralRules.prototype [ @@toStringTag ]","number":"16.3.2","referencingIds":["_ref_167"]},{"type":"clause","id":"sec-intl.pluralrules.prototype.select","title":"Intl.PluralRules.prototype.select ( value )","titleHTML":"Intl.PluralRules.prototype.select ( <var>value</var> )","number":"16.3.3"},{"type":"table","id":"table-pluralrules-resolvedoptions-properties","number":14,"caption":"Table 14: Resolved Options of PluralRules Instances","referencingIds":["_ref_107"]},{"type":"clause","id":"sec-intl.pluralrules.prototype.resolvedoptions","titleHTML":"Intl.PluralRules.prototype.resolvedOptions ( )","number":"16.3.4"},{"type":"clause","id":"sec-properties-of-intl-pluralrules-prototype-object","titleHTML":"Properties of the Intl.PluralRules Prototype Object","number":"16.3","referencingIds":["_ref_489","_ref_495"]},{"type":"clause","id":"sec-properties-of-intl-pluralrules-instances","titleHTML":"Properties of Intl.PluralRules Instances","number":"16.4"},{"type":"table","id":"table-plural-operands","number":15,"caption":"Table 15: Plural Rules Operands Record Fields"},{"type":"op","aoid":"GetOperands","refId":"sec-getoperands"},{"type":"clause","id":"sec-getoperands","title":"GetOperands ( s )","titleHTML":"GetOperands ( <var>s</var> )","number":"16.5.1","referencingIds":["_ref_497"]},{"type":"op","aoid":"PluralRuleSelect","refId":"sec-pluralruleselect"},{"type":"clause","id":"sec-pluralruleselect","title":"PluralRuleSelect ( locale, type, n, operands )","titleHTML":"PluralRuleSelect ( <var>locale</var>, <var>type</var>, <var>n</var>, <var>operands</var> )","number":"16.5.2","referencingIds":["_ref_108","_ref_498"]},{"type":"op","aoid":"ResolvePlural","refId":"sec-resolveplural"},{"type":"clause","id":"sec-resolveplural","title":"ResolvePlural ( pluralRules, n )","titleHTML":"ResolvePlural ( <var>pluralRules</var>, <var>n</var> )","number":"16.5.3","referencingIds":["_ref_494","_ref_524"]},{"type":"clause","id":"sec-intl-pluralrules-abstracts","titleHTML":"Abstract Operations for PluralRules Objects","number":"16.5"},{"type":"clause","id":"pluralrules-objects","titleHTML":"PluralRules Objects","number":"16","referencingIds":["_ref_25"]},{"type":"term","term":"%RelativeTimeFormat%","refId":"sec-intl-relativetimeformat-constructor"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat","title":"Intl.RelativeTimeFormat ( [ locales [ , options ] ] )","titleHTML":"Intl.RelativeTimeFormat ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"17.1.1"},{"type":"op","aoid":"InitializeRelativeTimeFormat","refId":"sec-InitializeRelativeTimeFormat"},{"type":"clause","id":"sec-InitializeRelativeTimeFormat","title":"InitializeRelativeTimeFormat ( relativeTimeFormat, locales, options )","titleHTML":"InitializeRelativeTimeFormat ( <var>relativeTimeFormat</var>, <var>locales</var>, <var>options</var> )","number":"17.1.2","referencingIds":["_ref_500"]},{"type":"clause","id":"sec-intl-relativetimeformat-constructor","titleHTML":"The Intl.RelativeTimeFormat Constructor","number":"17.1","referencingIds":["_ref_11","_ref_182","_ref_505","_ref_507","_ref_508","_ref_514","_ref_517","_ref_522"]},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype","titleHTML":"Intl.RelativeTimeFormat.prototype","number":"17.2.1"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.supportedLocalesOf","title":"Intl.RelativeTimeFormat.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.RelativeTimeFormat.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"17.2.2"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat-internal-slots","titleHTML":"Internal slots","number":"17.2.3","referencingIds":["_ref_156","_ref_157"]},{"type":"clause","id":"sec-properties-of-intl-relativetimeformat-constructor","titleHTML":"Properties of the Intl.RelativeTimeFormat Constructor","number":"17.2"},{"type":"term","term":"%RelativeTimeFormat.prototype%","refId":"sec-properties-of-intl-relativetimeformat-prototype-object"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype.constructor","titleHTML":"Intl.RelativeTimeFormat.prototype.constructor","number":"17.3.1"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype-toStringTag","titleHTML":"Intl.RelativeTimeFormat.prototype[ @@toStringTag ]","number":"17.3.2"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype.format","title":"Intl.RelativeTimeFormat.prototype.format ( value, unit )","titleHTML":"Intl.RelativeTimeFormat.prototype.format ( <var>value</var>, <var>unit</var> )","number":"17.3.3"},{"type":"clause","id":"sec-Intl.RelativeTimeFormat.prototype.formatToParts","title":"Intl.RelativeTimeFormat.prototype.formatToParts ( value, unit )","titleHTML":"Intl.RelativeTimeFormat.prototype.formatToParts ( <var>value</var>, <var>unit</var> )","number":"17.3.4"},{"type":"table","id":"table-relativetimeformat-resolvedoptions-properties","number":16,"caption":"Table 16: Resolved Options of RelativeTimeFormat Instances","referencingIds":["_ref_113"]},{"type":"clause","id":"sec-intl.relativetimeformat.prototype.resolvedoptions","titleHTML":"Intl.RelativeTimeFormat.prototype.resolvedOptions ( )","number":"17.3.5"},{"type":"clause","id":"sec-properties-of-intl-relativetimeformat-prototype-object","titleHTML":"Properties of the Intl.RelativeTimeFormat Prototype Object","number":"17.3","referencingIds":["_ref_513","_ref_520"]},{"type":"clause","id":"sec-properties-of-intl-relativetimeformat-instances","titleHTML":"Properties of Intl.RelativeTimeFormat Instances","number":"17.4"},{"type":"op","aoid":"SingularRelativeTimeUnit","refId":"sec-singularrelativetimeunit"},{"type":"clause","id":"sec-singularrelativetimeunit","title":"SingularRelativeTimeUnit ( unit )","titleHTML":"SingularRelativeTimeUnit ( <var>unit</var> )","number":"17.5.1","referencingIds":["_ref_521"]},{"type":"op","aoid":"PartitionRelativeTimePattern","refId":"sec-PartitionRelativeTimePattern"},{"type":"clause","id":"sec-PartitionRelativeTimePattern","title":"PartitionRelativeTimePattern ( relativeTimeFormat, value, unit )","titleHTML":"PartitionRelativeTimePattern ( <var>relativeTimeFormat</var>, <var>value</var>, <var>unit</var> )","number":"17.5.2","referencingIds":["_ref_528","_ref_529"]},{"type":"op","aoid":"MakePartsList","refId":"sec-makepartslist"},{"type":"clause","id":"sec-makepartslist","title":"MakePartsList ( pattern, unit, parts )","titleHTML":"MakePartsList ( <var>pattern</var>, <var>unit</var>, <var>parts</var> )","number":"17.5.3","referencingIds":["_ref_525","_ref_526"]},{"type":"op","aoid":"FormatRelativeTime","refId":"sec-FormatRelativeTime"},{"type":"clause","id":"sec-FormatRelativeTime","title":"FormatRelativeTime ( relativeTimeFormat, value, unit )","titleHTML":"FormatRelativeTime ( <var>relativeTimeFormat</var>, <var>value</var>, <var>unit</var> )","number":"17.5.4","referencingIds":["_ref_518"]},{"type":"op","aoid":"FormatRelativeTimeToParts","refId":"sec-FormatRelativeTimeToParts"},{"type":"clause","id":"sec-FormatRelativeTimeToParts","title":"FormatRelativeTimeToParts ( relativeTimeFormat, value, unit )","titleHTML":"FormatRelativeTimeToParts ( <var>relativeTimeFormat</var>, <var>value</var>, <var>unit</var> )","number":"17.5.5","referencingIds":["_ref_519"]},{"type":"clause","id":"sec-intl-relativetimeformat--abstracts","titleHTML":"Abstract Operations for RelativeTimeFormat Objects","number":"17.5"},{"type":"clause","id":"relativetimeformat-objects","titleHTML":"RelativeTimeFormat Objects","number":"17","referencingIds":["_ref_26"]},{"type":"term","term":"%Segmenter%","refId":"sec-intl-segmenter-constructor"},{"type":"clause","id":"sec-intl.segmenter","title":"Intl.Segmenter ( [ locales [ , options ] ] )","titleHTML":"Intl.Segmenter ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"18.1.1"},{"type":"clause","id":"sec-intl-segmenter-constructor","titleHTML":"The Intl.Segmenter Constructor","number":"18.1","referencingIds":["_ref_12","_ref_183","_ref_534","_ref_536","_ref_537","_ref_540","_ref_543"]},{"type":"clause","id":"sec-intl.segmenter.prototype","titleHTML":"Intl.Segmenter.prototype","number":"18.2.1"},{"type":"clause","id":"sec-intl.segmenter.supportedlocalesof","title":"Intl.Segmenter.supportedLocalesOf ( locales [ , options ] )","titleHTML":"Intl.Segmenter.supportedLocalesOf ( <var>locales</var> [ , <var>options</var> ] )","number":"18.2.2"},{"type":"clause","id":"sec-intl.segmenter-internal-slots","titleHTML":"Internal slots","number":"18.2.3"},{"type":"clause","id":"sec-properties-of-intl-segmenter-constructor","titleHTML":"Properties of the Intl.Segmenter Constructor","number":"18.2"},{"type":"term","term":"%Segmenter.prototype%","refId":"sec-properties-of-intl-segmenter-prototype-object"},{"type":"clause","id":"sec-intl.segmenter.prototype.constructor","titleHTML":"Intl.Segmenter.prototype.constructor","number":"18.3.1"},{"type":"clause","id":"sec-intl.segmenter.prototype-@@tostringtag","titleHTML":"Intl.Segmenter.prototype [ @@toStringTag ]","number":"18.3.2"},{"type":"clause","id":"sec-intl.segmenter.prototype.segment","title":"Intl.Segmenter.prototype.segment ( string )","titleHTML":"Intl.Segmenter.prototype.segment ( <var>string</var> )","number":"18.3.3"},{"type":"table","id":"table-segmenter-resolvedoptions-properties","number":17,"caption":"Table 17: Resolved Options of Segmenter Instances","referencingIds":["_ref_117"]},{"type":"clause","id":"sec-intl.segmenter.prototype.resolvedoptions","titleHTML":"Intl.Segmenter.prototype.resolvedOptions ( )","number":"18.3.4"},{"type":"clause","id":"sec-properties-of-intl-segmenter-prototype-object","titleHTML":"Properties of the Intl.Segmenter Prototype Object","number":"18.3","referencingIds":["_ref_539","_ref_545"]},{"type":"clause","id":"sec-properties-of-intl-segmenter-instances","titleHTML":"Properties of Intl.Segmenter Instances","number":"18.4"},{"type":"op","aoid":"CreateSegmentsObject","refId":"sec-createsegmentsobject"},{"type":"clause","id":"sec-createsegmentsobject","title":"CreateSegmentsObject ( segmenter, string )","titleHTML":"CreateSegmentsObject ( <var>segmenter</var>, <var>string</var> )","number":"18.5.1","referencingIds":["_ref_544"]},{"type":"term","term":"%SegmentsPrototype%","refId":"sec-%segmentsprototype%-object"},{"type":"clause","id":"sec-%segmentsprototype%.containing","title":"%SegmentsPrototype%.containing ( index )","titleHTML":"%SegmentsPrototype%.containing ( <var>index</var> )","number":"18.5.2.1"},{"type":"clause","id":"sec-%segmentsprototype%-@@iterator","titleHTML":"%SegmentsPrototype% [ @@iterator ] ( )","number":"18.5.2.2"},{"type":"clause","id":"sec-%segmentsprototype%-object","titleHTML":"The %SegmentsPrototype% Object","number":"18.5.2","referencingIds":["_ref_546","_ref_551"]},{"type":"clause","id":"sec-properties-of-segments-instances","titleHTML":"Properties of Segments Instances","number":"18.5.3"},{"type":"clause","id":"sec-segments-objects","titleHTML":"Segments Objects","number":"18.5"},{"type":"op","aoid":"CreateSegmentIterator","refId":"sec-createsegmentiterator"},{"type":"clause","id":"sec-createsegmentiterator","title":"CreateSegmentIterator ( segmenter, string )","titleHTML":"CreateSegmentIterator ( <var>segmenter</var>, <var>string</var> )","number":"18.6.1","referencingIds":["_ref_550"]},{"type":"term","term":"%SegmentIteratorPrototype%","refId":"sec-%segmentiteratorprototype%-object"},{"type":"clause","id":"sec-%segmentiteratorprototype%.next","titleHTML":"%SegmentIteratorPrototype%.next ( )","number":"18.6.2.1"},{"type":"clause","id":"sec-%segmentiteratorprototype%.@@tostringtag","titleHTML":"%SegmentIteratorPrototype% [ @@toStringTag ]","number":"18.6.2.2"},{"type":"clause","id":"sec-%segmentiteratorprototype%-object","titleHTML":"The %SegmentIteratorPrototype% Object","number":"18.6.2","referencingIds":["_ref_552","_ref_555"]},{"type":"table","id":"table-segment-iterator-instance-slots","number":18,"caption":"Table 18: Internal Slots of Segment Iterator Instances","referencingIds":["_ref_118"]},{"type":"clause","id":"sec-properties-of-segment-iterator-instances","titleHTML":"Properties of Segment Iterator Instances","number":"18.6.3"},{"type":"clause","id":"sec-segment-iterator-objects","titleHTML":"Segment Iterator Objects","number":"18.6"},{"type":"op","aoid":"CreateSegmentDataObject","refId":"sec-createsegmentdataobject"},{"type":"clause","id":"sec-createsegmentdataobject","title":"CreateSegmentDataObject ( segmenter, string, startIndex, endIndex )","titleHTML":"CreateSegmentDataObject ( <var>segmenter</var>, <var>string</var>, <var>startIndex</var>, <var>endIndex</var> )","number":"18.7.1","referencingIds":["_ref_159","_ref_549","_ref_554"]},{"type":"clause","id":"sec-segment-data-objects","titleHTML":"Segment Data Objects","number":"18.7"},{"type":"op","aoid":"FindBoundary","refId":"sec-findboundary"},{"type":"clause","id":"sec-findboundary","title":"FindBoundary ( segmenter, string, startIndex, direction )","titleHTML":"FindBoundary ( <var>segmenter</var>, <var>string</var>, <var>startIndex</var>, <var>direction</var> )","number":"18.8.1","referencingIds":["_ref_158","_ref_547","_ref_548","_ref_553"]},{"type":"clause","id":"sec-intl-segmenter-abstracts","titleHTML":"Abstract Operations for Segmenter Objects","number":"18.8"},{"type":"clause","id":"segmenter-objects","titleHTML":"Segmenter Objects","number":"18","referencingIds":["_ref_27"]},{"type":"clause","id":"sup-String.prototype.localeCompare","title":"String.prototype.localeCompare ( that [ , locales [ , options ] ] )","titleHTML":"String.prototype.localeCompare ( <var>that</var> [ , <var>locales</var> [ , <var>options</var> ] ] )","number":"19.1.1"},{"type":"op","aoid":"TransformCase","refId":"sec-transform-case"},{"type":"clause","id":"sec-transform-case","title":"TransformCase ( S, locales, targetCase )","titleHTML":"TransformCase ( <var>S</var>, <var>locales</var>, <var>targetCase</var> )","number":"19.1.2.1","referencingIds":["_ref_558","_ref_562"]},{"type":"clause","id":"sup-string.prototype.tolocalelowercase","title":"String.prototype.toLocaleLowerCase ( [ locales ] )","titleHTML":"String.prototype.toLocaleLowerCase ( [ <var>locales</var> ] )","number":"19.1.2"},{"type":"clause","id":"sup-string.prototype.tolocaleuppercase","title":"String.prototype.toLocaleUpperCase ( [ locales ] )","titleHTML":"String.prototype.toLocaleUpperCase ( [ <var>locales</var> ] )","number":"19.1.3"},{"type":"clause","id":"sup-properties-of-the-string-prototype-object","titleHTML":"Properties of the String Prototype Object","number":"19.1"},{"type":"clause","id":"sup-number.prototype.tolocalestring","title":"Number.prototype.toLocaleString ( [ locales [ , options ] ] )","titleHTML":"Number.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"19.2.1"},{"type":"clause","id":"sup-properties-of-the-number-prototype-object","titleHTML":"Properties of the Number Prototype Object","number":"19.2"},{"type":"clause","id":"sup-bigint.prototype.tolocalestring","title":"BigInt.prototype.toLocaleString ( [ locales [ , options ] ] )","titleHTML":"BigInt.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"19.3.1"},{"type":"clause","id":"sup-properties-of-the-bigint-prototype-object","titleHTML":"Properties of the BigInt Prototype Object","number":"19.3"},{"type":"clause","id":"sup-date.prototype.tolocalestring","title":"Date.prototype.toLocaleString ( [ locales [ , options ] ] )","titleHTML":"Date.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"19.4.1"},{"type":"clause","id":"sup-date.prototype.tolocaledatestring","title":"Date.prototype.toLocaleDateString ( [ locales [ , options ] ] )","titleHTML":"Date.prototype.toLocaleDateString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"19.4.2"},{"type":"clause","id":"sup-date.prototype.tolocaletimestring","title":"Date.prototype.toLocaleTimeString ( [ locales [ , options ] ] )","titleHTML":"Date.prototype.toLocaleTimeString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"19.4.3"},{"type":"clause","id":"sup-properties-of-the-date-prototype-object","titleHTML":"Properties of the Date Prototype Object","number":"19.4"},{"type":"clause","id":"sup-array.prototype.tolocalestring","title":"Array.prototype.toLocaleString ( [ locales [ , options ] ] )","titleHTML":"Array.prototype.toLocaleString ( [ <var>locales</var> [ , <var>options</var> ] ] )","number":"19.5.1"},{"type":"clause","id":"sup-properties-of-the-array-prototype-object","titleHTML":"Properties of the Array Prototype Object","number":"19.5"},{"type":"clause","id":"locale-sensitive-functions","titleHTML":"Locale Sensitive Functions of the ECMAScript Language Specification","number":"19"},{"type":"clause","id":"annex-implementation-dependent-behaviour","titleHTML":"Implementation Dependent Behaviour","number":"A"},{"type":"clause","id":"annex-incompatibilities","titleHTML":"Additions and Changes That Introduce Incompatibilities with Prior Editions","number":"B"},{"type":"clause","id":"sec-colophon","titleHTML":"Colophon","number":"C","referencingIds":["_ref_0"]},{"type":"clause","id":"sec-copyright-and-software-license","title":"Copyright & Software License","titleHTML":"Copyright &amp; Software License","number":"D"}]}`);
;let usesMultipage = false