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

				break;
			default:
				throw "supported: Unknown or unsupported key.";
		}
	}


	// AcID DOM Inspector definition (using module pattern).
	var ADI = (function() {
		// private methods and variables
		var Node = window.Node || nodeTypesShim(),
			ui = null,
			menu = null,
			selectedElement = null,
			vertResizing = false,
			horizResizing = false,
			xPos = 0,
			nLevel = 0,
			options = {
				align: 'right',
				width: 300,
				minWidth: 260,
				split: 50,
				minSplit: 30,
				visible: true,
				saving: false,
				// nodeTypes: {
				// 	Node.DOCUMENT_NODE : true
				// 	Node.TEXT_NODE : true,
				// 	Node.ELEMENT_NODE : true
				// }
				nodeTypes: [1, 3, 9]
			};



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

		// Renders the DOM Tree view
		function drawDOM(root, isRoot) {
			// .childElementCount == .children.length
			// .childNodes <= .hasChildNodes (contains TEXT_NODE nodes)

			if (typeof root !== 'object') {
				throw "drawDOM: Expected argument root of type object, " + typeof root + " given.";
			}

			if (isRoot && options.nodeTypes.indexOf(root.nodeType) !== -1) {
				console.log(root, nLevel, root.nodeType);
			}

			// recursive DOM traversal
			for (var i = 0, len = root.childNodes.length; i < len; ++i) {
				var node = root.childNodes[i];
				nLevel += 1;

				// TODO: tree rendering
				if (options.nodeTypes.indexOf(node.nodeType) !== -1) {
					console.log(node, nLevel, node.nodeType);
				}

				if (node.hasChildNodes()) {
					drawDOM(node, false);
				}
				nLevel -= 1;
			}
		}

		// Renders the UI
		function drawUI() {
			var wrapper = newElement('div', {
					id: 'adi-wrapper'
				}),
				navi = newElement('div', {
					id: 'adi-menu'
				}),
				domView = newElement('div', {
					id: 'adi-dom-view'
				}),
				domViewContent = newElement('div', {
					class: 'adi-content'
				}),
				attrView = newElement('div', {
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
				});


			// NOTE: debug only
			domViewContent.textContent = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci culpa beatae ipsa necessitatibus perferendis iste possimus eius dolorem et aspernatur officiis iure architecto dolorum rerum vitae quaerat harum voluptatibus velit! Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci culpa beatae ipsa necessitatibus perferendis iste possimus eius dolorem et aspernatur officiis iure architecto dolorum rerum vitae quaerat harum voluptatibus velit!';
			attrViewContent.textContent = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit. Deserunt itaque et animi dolor corporis qui minus quos maiores cumque voluptates totam voluptas eligendi ad temporibus laboriosam odio blanditiis atque inventore. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Adipisci culpa beatae ipsa necessitatibus perferendis iste possimus eius dolorem et aspernatur officiis iure architecto dolorum rerum vitae quaerat harum voluptatibus velit!';

			// put UI together
			domView.appendChild(domViewContent);
			attrView.appendChild(attrViewContent);
			wrapper.appendChild(domView);
			wrapper.appendChild(horizSplit);
			wrapper.appendChild(attrView);
			wrapper.appendChild(navi);
			wrapper.appendChild(vertSplit);

			// cache UI object and append to the DOM
			document.getElementsByTagName('body')[0].appendChild(wrapper);
			ui = wrapper;
			menu = navi;
			refreshUI(true);
		}

		// Refreshes the global UI
		function refreshUI(refreshOpts) {
			if (ui === null) {
				return false;
			}

			// load options if requested (e.g. before the first UI refresh)
			if (refreshOpts) {
				loadOptions();
			}

			var domView = ui.querySelector('#adi-dom-view'),
				attrView = ui.querySelector('#adi-attr-view');

			// UI appearance refresh
			ui.style.display = options.visible ? 'block' : 'none';
			ui.style.width = options.width + 'px';
			menu.style.width = options.width + 'px';
			domView.style.height = options.split + '%';
			attrView.style.height = (100 - options.split) + '%';
			domView.querySelector('.adi-content').style.height = domView.clientHeight + 'px';
			attrView.querySelector('.adi-content').style.height = (attrView.clientHeight - menu.clientHeight) + 'px';
			addClass(ui, options.align);
		}

		// UI visibility toggle handler
		function toggleVisibilityUI() {
			if (ui === null) {
				return false;
			}

			ui.style.display = options.visible ? 'none' : 'block';
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
		}

		// Horizontal splitter resize handler
		function horizontalResize(e) {
			if (!horizResizing) {
				return;
			}

			e = e || window.event;
			document.body.style.cursor = 'n-resize';
			var nSplit = Math.floor(e.clientY / ui.clientHeight * 100);

			if (nSplit >= options.minSplit && nSplit <= 100 - options.minSplit) {
				options.split = nSplit;
				refreshUI();
				saveOptions();
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
			}, false);

			addEvent(document, 'mouseup', function() {
				document.body.style.cursor = 'default';
				horizResizing = false;
			}, false);

			addEvent(document, 'mousemove', verticalResize, false);
			addEvent(document, 'mousemove', horizontalResize, false);

			// window resize
			addEvent(window, 'resize', refreshUI, false);

			// keypress events
			addEvent(document, 'keypress', processKey, false);


			// TODO: Menu events

		}

		drawUI();
		registerEvents();

		return {
			// TODO: public methods and variables (this will be visible to the global scope)
			// TODO: getSelectedElement() method
			toggle: toggleVisibilityUI,
			dom: drawDOM,
			options: options  // FIXME: remove
		};
	})();

	// Application entry point
	function appInit() {
		consoleShim();
		// TODO: other invocations if needed

		// make public API visible to the global scope
		window.ADI = ADI;
	}

	// Launch the app when the DOM is ready and all assets are loaded
	addEvent(window, 'load', appInit, false);
})(this, document);
