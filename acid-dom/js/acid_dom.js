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

	// Console compatibility shim
	function consoleShim() {
		// missing console workaround
		if (typeof window.console === 'undefined') {
			var console = {};
			console.log = console.error = console.warn = console.dir = function() {};
		}
	}

	// Simple cross-browser event handler
	function addEvent(obj, evt, fn, capture) {
		if (typeof obj !== 'object') {
			return false;
		}

		if (window.addEventListener) {
			if (!capture) {
				capture = false;
			}

			obj.addEventListener(evt, fn, capture);
		} else {
			obj.attachEvent('on' + evt, fn);
		}
	}

	// Simple cross-browser event handler that enables simple event delegation
	// Note that the selector must be a string and no nesting is supported. Selector
	// will be tested for one of the formats and will work for all children in
	// a particular element.
	// Selector formats: tag name ("div"), class name (".my-class") and id ("#my-id").
	function addEventDelegate(obj, evt, fn, capture, selector) {
		// custom event handler is registered
		addEvent(obj, evt, function(e) {
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

	// Create element wrapper -- allows to set attributes using the config object
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


	// AcID DOM Inspector definition (using module pattern)
	var ADI = (function() {
		// TODO: private methods and variables

		return {
			// TODO: public methods and variables (this will be visible to the global scope)
			test : 3
		};
	})();

	// Renders the UI
	// function drawUI() {
	// 	var wrapper = newElement('div', {
	// 		'id' : 'acid-di-wrapper'
	// 	});

	// 	document.getElementsByTagName('body')[0].appendChild(wrapper);
	// }

	// Application entry point
	function appInit() {
		consoleShim();
		// TODO: other invocations

		// make public API visible to the global scope
		window.ADI = ADI;
	}

	// Launch the app when the DOM is ready and all assets are loaded
	addEvent(window, 'load', appInit, false);
})(this, document);
