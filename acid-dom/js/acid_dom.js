/**
 * AcID Dom Inspector 1.0
 *
 * @file        acid_dom.js
 * @author      Jan Myler <info@janmyler.com>
 * @copyright   Copyright 2013, Jan Myler (http://janmyler.com)
 * @license     MIT License (http://www.opensource.org/licenses/mit-license.php)
 *
 * Licensed under The MIT License
 * Redistributions of files must retain the above copyright notice.
 */

(function(window, document, undefined) {
	'use strict';

	// Console compatibility shim.
	function consoleShim() {
		// missing console workaround
		if (typeof window.console === 'undefined') {
			var console = {};
			console.log = console.error = console.warn = console.dir = function() {};
		}
	}

	// Node types shim -- creates Node type constants if necessary
	function nodeTypesShim() {
		if (!window.Node) {
			return {
				ELEMENT_NODE                :  1,
				ATTRIBUTE_NODE              :  2,
				TEXT_NODE                   :  3,
				CDATA_SECTION_NODE          :  4,
				ENTITY_REFERENCE_NODE       :  5,
				ENTITY_NODE                 :  6,
				PROCESSING_INSTRUCTION_NODE :  7,
				COMMENT_NODE                :  8,
				DOCUMENT_NODE               :  9,
				DOCUMENT_TYPE_NODE          : 10,
				DOCUMENT_FRAGMENT_NODE      : 11,
				NOTATION_NODE               : 12
			};
		}
	}

	// Simple cross-browser event handler.
	function addEvent(elem, evt, fn, capture) {
		if (typeof elem !== 'object') {
			throw "addEvent: Expected argument elem of type object, " + typeof elem + " given.";
		}

		if (window.addEventListener) {
			if (!capture) {
				capture = false;
			}

			elem.addEventListener(evt, fn, capture);
		} else {
			elem.attachEvent('on' + evt, fn);
		}
	}

	// Simple cross-browser event handler that enables simple event delegation.
	// Note that the selector must be a string and no nesting is supported.
	// Selector is expected to be in one of formats listed below and works for all children
	// in the particular element.
	// Selector formats: tag name ("div"), class name (".my-class") and id ("#my-id").
	function addEventDelegate(elem, evt, fn, capture, selector) {
		// custom event handler is registered
		addEvent(elem, evt, function(e) {
			// check if the target corresponds to the selector
			var target = e ? e.target : window.event.srcElement,
				sel = selector.substr(1),
				delegate = false;

			// should the event be delegated?
			if (selector.indexOf('#') === 0) {	// ID
				delegate = target.id === sel;
			} else if (selector.indexOf('.') === 0) { // class
				delegate = target.className.indexOf(sel) !== -1;
			} else { // tag name
				delegate = target.nodeName.toLowerCase() === selector;
			}

			// delegate the event handling
			if (delegate) {
				fn.call(this, e);
			}
		}, capture);
	}

	// Stops event propagation and also prevents the default behavior.
	function pauseEvent(e){
		if(e.stopPropagation) {
			e.stopPropagation();
		}

		if(e.preventDefault) {
			e.preventDefault();
		}

		e.cancelBubble = true;
		e.returnValue = false;

		return false;
	}

	// Create element wrapper -- allows to set attributes using the config object.
	function newElement(elem, attrs) {
		var el = document.createElement(elem);

		attrs = attrs || {};
		for (var attr in attrs) {
			// work only with direct (non-inherited) properties
			if (attrs.hasOwnProperty(attr)) {
				el.setAttribute(attr, attrs[attr]);
			}
		}

		return el;
	}

	// Function adds a class to the element, only if the class does not already exist.
	// Cls parameter may be either a string or an array listing multiple classes.
	// Implementation uses modern element.classList API if available, dummy shim provided for older
	// browsers.
	function addClass(elem, cls) {
		if (typeof elem !== 'object') {
			throw "addClass: Expected argument elem of type object, " + typeof elem + " given.";
		}

		// normalize to array
		if (typeof cls === 'string') {
			cls = [cls];
		}

		// iterate over classes and add new if necessary
		for (var i = 0, len = cls.length; i < len; ++i) {
			if (supported('classList')) {
				elem.classList.add(cls[i]);
			} else {
				// prevents the match when new class is only a substring of another class name
				if (!new RegExp('(?:^|\\s)' + cls[i] + '(?:\\s|$)').test(elem.className)) {
					elem.className += ' ' + cls[i];
				}
			}
		}
	}

	// Function removes a class from the element, only if the class exists.
	// Cls parameter may be either a string or an array listing multiple classes.
	// Implementation uses modern element.classList API if available, dummy shim provided for older
	// browsers.
	function removeClass(elem, cls) {
		if (typeof elem !== 'object') {
			throw "removeClass: Expected argument elem of type object, " + typeof elem + " given.";
		}

		// normalize to array
		if (typeof cls === 'string') {
			cls = [cls];
		}

		// iterate over classes and remove if necessary
		for (var i = 0, len = cls.length; i < len; ++i) {
			if (supported('classList')) {
				elem.classList.remove(cls[i]);
			} else {
				// removes the class if it exists
				var newClassName = elem.className.replace(new RegExp('(?:^|\\s)' + cls[i] + '(?:\\s|$)', 'g'), ' ');
				elem.className = newClassName.replace(/^\s+|\s+$/g, '');
			}
		}
	}

	// Functions checks whether the feature is supported.
	function supported(key) {
		switch (key) {
			case 'localStorage':
				try {
					return 'localStorage' in window && !!window.localStorage;
				} catch (e) {
					return false;
				}

				break;
			case 'classList':
				return 'classList' in document.createElement('a');

			default:
				throw "supported: Unknown or unsupported key.";
		}
	}


	// AcID DOM Inspector definition (using module pattern).
	var ADI = (function() {
		// private methods and variables
		var Node = window.Node || nodeTypesShim(),
			uiView = null,
			menuView = null,
			domView = null,
			attrView = null,
			pathView = null,
			activeElement = null,
			vertResizing = false,
			horizResizing = false,
			pathScrolling = null,
			xPos = 0,
			options = {
				align: 'right',  // NOTE: left is not supported in this version
				width: 340,
				minWidth: 260,
				split: 50,
				minSplit: 30,
				visible: true,
				saving: false,
				omitEmptyText: true,
				foldText: true,
				nodeTypes: [1, 3, 8, 9]
			};

		// Returns selected element or null
		function getSelected() {
			if (!activeElement) {
				return null;
			}

			var elem = document,
				path = JSON.parse(activeElement.getAttribute('data-js-path'));

			if (path[0] !== "") {
				for (var i = 0, len = path.length; i < len; ++i) {
					elem = elem.childNodes[path[i]];
				}
			}

			return elem;
		}

		// Loads user defined options stored in HTML5 storage (if available)
		function loadOptions() {
			var userOptions = {};

			if (supported('localStorage')) {
				userOptions = JSON.parse(localStorage.getItem('ADI.options')) || {};
			}

			// merge with defaults
			for (var opt in userOptions) {
				options[opt] = userOptions[opt];
			}
		}

		// Saves user defined options into the HTML5 storage (if available)
		function saveOptions() {
			if (supported('localStorage') && options.saving) {
				localStorage.setItem('ADI.options', JSON.stringify(options));
			}
		}

		// Resets user defined options and removes them from the HTML5 storage
		function resetOptions() {
			if (supported('localStorage')) {
				localStorage.removeItem('ADI.options');
			}
		}

		// Generates UUID
		function getUuid() {
			var i, random,
				uuid = '';

			for (i = 0; i < 32; i++) {
				random = Math.random() * 16 | 0;
				if (i === 8 || i === 12 || i === 16 || i === 20) {
					uuid += '-';
				}
				uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
			}
			return uuid;
		}

		// Returns CSS and JS paths to the element
		// Result is an object with two variables (cssPath, jsPath) where cssPath is a string
		// which holds the css path starting from the HTML element, and jsPath is an array which
		// contains indexes for childNodes arrays (starting at document object).
		//
		// Inspired by the selector function from Rochester Oliveira's jQuery plugin
		// http://rockingcode.com/tutorial/element-dom-tree-jquery-plugin-firebug-like-functionality/
		function getElemPaths(elem) {
			if (typeof elem !== 'object') {
				throw "getElemPaths: Expected argument elem of type object, " + typeof elem + " given.";
			}

			var css = "",
				js = "",
				parent = "",
				i, len;

			while (elem !== document) {
				parent = elem.parentNode;

				// javascript selector
				for (i = 0, len = parent.childNodes.length; i < len; ++i) {
					if (parent.childNodes[i] === elem) {
						js = i + "," + js;
						break;
					}
				}

				// CSS selector
				var cssTmp = elem.nodeName;

				if (elem.id) {
					cssTmp += '#' + elem.id;
				}

				if (elem.className) {
					// use classList if available
					var classList = elem.classList || elem.className.split(' ');

					for (i = 0, len = classList.length; i < len; ++i) {
						cssTmp += '.' + classList[i];
					}
				}

				css = cssTmp + ' ' + css;
				elem = elem.parentNode;
			}

			js = js.slice(0, -1).split(',');

			return {
				cssPath: css.toLowerCase(),
				jsPath: js
			};
		}

		// Checks if a node has some child nodes and if at least on of them is of a supported type
		function hasRequiredNodes(node) {
			if (typeof node !== 'object') {
				throw "hasRequiredNodes: Expected argument node of type object, " + typeof node + " given.";
			}

			if (node.hasChildNodes()) {
				for (var i = 0, len = node.childNodes.length; i < len; i++) {
					if (options.nodeTypes.indexOf(node.childNodes[i].nodeType) !== -1) {
						return true;
					}
				}
			}

			return false;
		}

		// Checks whether the text node is not empty or contains only the EOL
		function isEmptyTextNode(node) {
			if (typeof node !== 'object') {
				throw "isEmptyTextNode: Expected argument node of type object, " + typeof node + " given.";
			}

			return (/^\s*$/).test(node.textContent);
		}

		// Checks whether the node or its children contains only text information
		function containsOnlyText(node, checkChildren) {
			if (typeof node !== 'object') {
				throw "containsOnlyText: Expected argument node of type object, " + typeof node + " given.";
			}

			checkChildren = checkChildren || false;

			var result = false,
				nodeTmp = null;

			// does the node contain only text nodes?
			if (checkChildren) {
				for (var i = 0, len = node.childNodes.length; i < len; ++i) {
					nodeTmp = node.childNodes[i];
					result = nodeTmp.nodeType === Node.TEXT_NODE
							|| nodeTmp.nodeType === Node.COMMENT_NODE
							|| nodeTmp.nodeType === Node.CDATA_SECTION_NODE;

					if (!result) {
						break;
					}
				}
			} else {
				// check the node type if it doesn't have any children
				result = node.nodeType === Node.TEXT_NODE
						|| node.nodeType === Node.COMMENT_NODE
						|| node.nodeType === Node.CDATA_SECTION_NODE;
			}

			return result;
		}

		// Creates a starting markup for a new DOM tree view node
		function newTreeNode(node) {
			if (typeof node !== 'object') {
				throw "newTreeNode: Expected argument node of type object, " + typeof node + " given.";
			}

			var withChildren = hasRequiredNodes(node),
				omit = false,
				elem = newElement('li', {
					class: (withChildren ? 'adi-node' : '')
				});

			// do not show ADI DOM nodes in the DOM view
			if (node === uiView) {
				return null;
			}

			// generate UI for elements with children
			if (withChildren) {
				elem.appendChild(newElement('span', { class: 'adi-trigger' }));
			}

			// we can omit empty text nodes if allowed in options
			if (options.omitEmptyText && node.nodeType === Node.TEXT_NODE) {
				omit = isEmptyTextNode(node);
			}

			if (!omit) {
				var path = getElemPaths(node),
					content = newElement('span', {
						'data-css-path' : path.cssPath,
						'data-js-path'  : JSON.stringify(path.jsPath)
					});

				if (containsOnlyText(node)) {

					if (node.nodeType === Node.COMMENT_NODE) {
						addClass(content, 'adi-comment-node');
						if (typeof content.innerText === 'string') {
							content.innerText = '<!-- ' + node.textContent + ' -->';
						} else {
							content.textContent = '<!-- ' + node.textContent + ' -->';
						}
					} else {
						addClass(content, 'adi-text-node');
						content.textContent = node.textContent;
					}
				} else {
					addClass(content, 'adi-normal-node');
					content.textContent = node.nodeName.toLowerCase();
				}

				elem.appendChild(content);
				return elem;
			} else {
				return null;
			}
		}

		// Renders the DOM Tree view
		function drawDOM(root, elem, isRoot) {
			// .childElementCount == .children.length
			// .childNodes <= .hasChildNodes (contains TEXT_NODE nodes)

			if (typeof root !== 'object') {
				throw "drawDOM: Expected argument root of type object, " + typeof root + " given.";
			}

			var newNode = null,
				isOpen = true;

			if (isRoot && options.nodeTypes.indexOf(root.nodeType) !== -1) {
				// console.log(root, nLevel, root.nodeType);
				newNode = newTreeNode(root);

				if (hasRequiredNodes(root)) {
					newNode.appendChild(newElement('ul', { 'data-open' : true }));
					addClass(newNode.querySelector('.adi-trigger'), 'opened');
				}

				elem.appendChild(newNode);
				elem = elem.querySelector('ul');
			}

			// recursive DOM traversal
			for (var i = 0, len = root.childNodes.length; i < len; ++i) {
				var node = root.childNodes[i],
					withChildren = hasRequiredNodes(node);

				// TODO: tree rendering
				if (options.nodeTypes.indexOf(node.nodeType) !== -1) {
					newNode = newTreeNode(node);

					if (newNode) {
						if (withChildren) {
							if (options.foldText) {
								isOpen = containsOnlyText(node, true) ? false : true;
							} else {
								isOpen = true;
							}

							newNode.appendChild(newElement('ul', { 'data-open' : isOpen }));
							addClass(newNode.querySelector('.adi-trigger'), isOpen ? 'opened' : 'closed');
						}

						elem.appendChild(newNode);

						if (withChildren) {
							drawDOM(node, newNode.querySelector('ul'), false);
						}
					}
				}
			}
		}

		// Renders the UI
		function drawUI() {
			var wrapper = newElement('div', {
					id: 'adi-wrapper'
				}),
				navi = newElement('div', {
					id: 'adi-panel'
				}),
				domViewWrap = newElement('div', {
					id: 'adi-dom-view'
				}),
				domViewContent = newElement('div', {
					class: 'adi-content'
				}),
				attrViewWrap = newElement('div', {
					id: 'adi-attr-view'
				}),
				attrViewContent = newElement('div', {
					class: 'adi-content'
				}),
				horizSplit = newElement('div', {
					id: 'adi-horiz-split'
				}),
				vertSplit = newElement('div', {
					id: 'adi-vert-split'
				}),
				domTree = newElement('ul', {
					class: 'adi-tree-view'
				}),
				domPathWrap = newElement('div', {
					class: 'adi-path-wrap'
				}),
				domPath = newElement('div', {
					class: 'adi-path'
				}),
				domPathScrollLeft = newElement('span', {
					class: 'adi-path-left'
				}),
				domPathScrollRight = newElement('span', {
					class: 'adi-path-right'
				});

			// put UI together
			domViewContent.appendChild(domTree);
			domViewWrap.appendChild(domViewContent);
			attrViewWrap.appendChild(attrViewContent);
			domPathWrap.appendChild(domPath);
			domPathWrap.appendChild(domPathScrollLeft);
			domPathWrap.appendChild(domPathScrollRight);
			navi.appendChild(domPathWrap);
			wrapper.appendChild(domViewWrap);
			wrapper.appendChild(horizSplit);
			wrapper.appendChild(attrViewWrap);
			wrapper.appendChild(navi);
			wrapper.appendChild(vertSplit);

			// cache UI object and append to the DOM
			document.getElementsByTagName('body')[0].appendChild(wrapper);
			uiView = wrapper;
			menuView = navi;
			domView = uiView.querySelector('#adi-dom-view');
			attrView = uiView.querySelector('#adi-attr-view');
			pathView = domPath;
			refreshUI(true);
		}

		// Refreshes the global UI
		function refreshUI(refreshOpts) {
			if (uiView === null) {
				return false;
			}

			// load options if requested (e.g. before the first UI refresh)
			if (refreshOpts) {
				loadOptions();
			}

			// UI appearance refresh
			uiView.style.display = options.visible ? 'block' : 'none';
			uiView.style.width = options.width + 'px';
			menuView.style.width = options.width + 'px';
			domView.style.height = options.split + '%';
			attrView.style.height = (100 - options.split) + '%';
			domView.querySelector('.adi-content').style.height = domView.clientHeight + 'px';
			attrView.querySelector('.adi-content').style.height = (attrView.clientHeight - menuView.clientHeight) + 'px';
			addClass(uiView, options.align);
		}

		// UI visibility toggle handler
		function toggleVisibilityUI() {
			if (uiView === null) {
				return false;
			}

			uiView.style.display = options.visible ? 'none' : 'block';
			options.visible = !options.visible;
			saveOptions();
		}

		// Key events processing
		function processKey(e) {
			e = e || window.event;
			var code = e.keyCode || e.which;

			switch (code) {
				case 272: // ctrl + alt + d
					toggleVisibilityUI();
					break;
			}
		}

		// Vertical splitter resize handler
		function verticalResize(e) {
			if (!vertResizing) {
				return;
			}

			e = e || window.event;
			document.body.style.cursor = 'e-resize';
			var nWidth = options.width + xPos - e.clientX;

			if (nWidth >= options.minWidth) {
				options.width = nWidth;
				xPos = e.clientX;
				refreshUI();
				saveOptions();
			}

			checkPathOverflow();
		}

		// Horizontal splitter resize handler
		function horizontalResize(e) {
			if (!horizResizing) {
				return;
			}

			e = e || window.event;
			document.body.style.cursor = 'n-resize';
			var nSplit = Math.floor(e.clientY / uiView.clientHeight * 100);

			if (nSplit >= options.minSplit && nSplit <= 100 - options.minSplit) {
				options.split = nSplit;
				refreshUI();
				saveOptions();
			}
		}

		// Dom view folding handler
		function handleFolding(e) {
			var target = e ? e.target : window.event.srcElement,
				ul = target.parentNode.querySelector('ul');

			if (ul.getAttribute('data-open') === "true") {
				removeClass(target, 'opened');
				addClass(target, 'closed');
				ul.setAttribute('data-open', "false");
			} else {
				removeClass(target, 'closed');
				addClass(target, 'opened');
				ul.setAttribute('data-open', "true");
			}
		}

		// Handles active element selection
		function handleActive(e) {
			var target = e ? e.target : window.event.srcElement,
				active = domView.querySelector('.adi-active-node');

			if (active) {
				removeClass(active, 'adi-active-node');
			}

			activeElement = target;
			addClass(target, 'adi-active-node');
			pathView.textContent = target.getAttribute('data-css-path');

			checkPathOverflow();
		}

		function checkPathOverflow() {
			if (pathView.scrollWidth > pathView.clientWidth) {
				addClass(pathView.parentNode, 'adi-overflowing');
			} else {
				removeClass(pathView.parentNode, 'adi-overflowing');
			}
		}

		function scrollPathView(e) {
			var target = e ? e.target : window.event.srcElement,
				maxScroll = pathView.scrollWidth - pathView.clientWidth,
				scroll = pathView.scrollLeft,
				change = 5;

				if (target.className === "adi-path-right") {
					pathView.scrollLeft = (scroll <= maxScroll - change) ? scroll + change : maxScroll;
				} else {
					pathView.scrollLeft = (scroll - change >= 0) ? scroll - change : 0;
				}

			if (!pathScrolling) {
				pathScrolling = setInterval(scrollPathView, 20, e);
			}
		}

		// Event registration
		function registerEvents() {
			var vertSplit = document.getElementById('adi-vert-split'),
				horizSplit = document.getElementById('adi-horiz-split');

			// events for splitters
			addEvent(vertSplit,  'mousedown', function(e) {
				e = e || window.event;
				pauseEvent(e);
				vertResizing  = true;
				xPos = e.clientX;
			}, false);

			addEvent(horizSplit, 'mousedown', function(e) {
				e = e || window.event;
				pauseEvent(e);
				horizResizing = true;
			}, false);

			addEvent(document, 'mouseup', function() {
				document.body.style.cursor = 'default';
				vertResizing  = false;
				horizResizing = false;
			}, false);

			addEvent(document, 'mousemove', verticalResize, false);
			addEvent(document, 'mousemove', horizontalResize, false);

			// window resize
			addEvent(window, 'resize', refreshUI, false);

			// keypress events
			addEvent(document, 'keypress', processKey, false);

			// dom tree view folding
			addEventDelegate(domView, 'click', handleFolding, false, '.adi-trigger');

			// active element
			addEventDelegate(domView, 'click', handleActive, false, '.adi-normal-node');

			// path view scrolling
			addEventDelegate(pathView.parentNode, 'mousedown', scrollPathView, false, '.adi-path-left');
			addEventDelegate(pathView.parentNode, 'mousedown', scrollPathView, false, '.adi-path-right');
			addEventDelegate(pathView.parentNode, 'mouseup', function() {
				clearInterval(pathScrolling);
				pathScrolling = false;
			}, false, '.adi-path-left');
			addEventDelegate(pathView.parentNode, 'mouseup', function() {
				clearInterval(pathScrolling);
				pathScrolling = false;
			}, false, '.adi-path-right');

			// TODO: Menu events
		}

		drawUI();
		registerEvents();
		drawDOM(document, domView.querySelector('.adi-tree-view'), true);

		return {
			// TODO: public methods and variables (this will be visible to the global scope)
			getSelectedElement: getSelected,
			toggle: toggleVisibilityUI,
			options: options,  // FIXME: remove
			getPaths: getElemPaths
		};
	})();

	// Application entry point
	function appInit() {
		consoleShim();

		// make public API visible to the global scope
		window.ADI = ADI;
	}

	// Launch the app when the DOM is ready and all assets are loaded
	addEvent(window, 'load', appInit, false);
})(this, document);
