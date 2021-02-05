/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const util = require("util");

const deprecateContext = util.deprecate(() => {},
"Hook.context is deprecated and will be removed");

const CALL_DELEGATE = function(...args) {
	this.call = this._createCall("sync");
	return this.call(...args);
};
const CALL_ASYNC_DELEGATE = function(...args) {
	this.callAsync = this._createCall("async");
	return this.callAsync(...args);
};
// 方法代理，代理方法是动态生成的，然后执行生成的函数
const PROMISE_DELEGATE = function(...args) {
	this.promise = this._createCall("promise");
	return this.promise(...args);
};

class Hook {
	constructor(args = [], name = undefined) {
		this._args = args;
		this.name = name;
		// 不论什么类型的插件，都会被标准化之后插入该列表，插件类型通过对象的type字段区分。
		// 该数组是个有序列表，插入时会根据before和stage字段确认插入位置。
		this.taps = [];
		this.interceptors = [];
		/**
		 * 由于hook的类型还不确定，对于插件如何调用还不明确，
		 * 所以这里使用了代理，在运行时动态生成调用方法并执行。
		 */
		this._call = CALL_DELEGATE;
		this.call = CALL_DELEGATE;
		this._callAsync = CALL_ASYNC_DELEGATE;
		this.callAsync = CALL_ASYNC_DELEGATE;
		this._promise = PROMISE_DELEGATE;
		this.promise = PROMISE_DELEGATE;
		this._x = undefined;

		// 原型方法变实例方法，Hook导出时将原型对象置空了
		this.compile = this.compile;
		this.tap = this.tap;
		this.tapAsync = this.tapAsync;
		this.tapPromise = this.tapPromise;
	}

	compile(options) {
		throw new Error("Abstract: should be overridden");
	}

	// 根据提供的类型，生成对应的插件执行方式
	_createCall(type) {
		return this.compile({
			taps: this.taps,
			interceptors: this.interceptors,
			args: this._args,
			type: type
		});
	}

	_tap(type, options, fn) {
		if (typeof options === "string") {
			options = {
				name: options.trim()
			};
		} else if (typeof options !== "object" || options === null) {
			throw new Error("Invalid tap options");
		}
		if (typeof options.name !== "string" || options.name === "") {
			throw new Error("Missing name for tap");
		}
		if (typeof options.context !== "undefined") {
			deprecateContext();
		}
		options = Object.assign({ type, fn }, options);
		options = this._runRegisterInterceptors(options);
		this._insert(options);
	}

	tap(options, fn) {
		this._tap("sync", options, fn);
	}

	tapAsync(options, fn) {
		this._tap("async", options, fn);
	}

	tapPromise(options, fn) {
		this._tap("promise", options, fn);
	}

	_runRegisterInterceptors(options) {
		for (const interceptor of this.interceptors) {
			if (interceptor.register) {
				const newOptions = interceptor.register(options);
				if (newOptions !== undefined) {
					options = newOptions;
				}
			}
		}
		return options;
	}

	withOptions(options) {
		const mergeOptions = opt =>
			Object.assign({}, options, typeof opt === "string" ? { name: opt } : opt);

		return {
			name: this.name,
			tap: (opt, fn) => this.tap(mergeOptions(opt), fn),
			tapAsync: (opt, fn) => this.tapAsync(mergeOptions(opt), fn),
			tapPromise: (opt, fn) => this.tapPromise(mergeOptions(opt), fn),
			intercept: interceptor => this.intercept(interceptor),
			isUsed: () => this.isUsed(),
			withOptions: opt => this.withOptions(mergeOptions(opt))
		};
	}

	isUsed() {
		return this.taps.length > 0 || this.interceptors.length > 0;
	}

	intercept(interceptor) {
		this._resetCompilation();
		this.interceptors.push(Object.assign({}, interceptor));
		if (interceptor.register) {
			// 中间件注册时，对所有**已经**注册的插件执行register函数
			for (let i = 0; i < this.taps.length; i++) {
				this.taps[i] = interceptor.register(this.taps[i]);
			}
		}
	}

	_resetCompilation() {
		this.call = this._call;
		this.callAsync = this._callAsync;
		this.promise = this._promise;
	}

	_insert(item) {
		this._resetCompilation();
		let before;
		if (typeof item.before === "string") {
			before = new Set([item.before]);
		} else if (Array.isArray(item.before)) {
			before = new Set(item.before);
		}
		let stage = 0;
		if (typeof item.stage === "number") {
			stage = item.stage;
		}
		let i = this.taps.length;
		while (i > 0) {
			i--;
			const x = this.taps[i];
			this.taps[i + 1] = x;
			const xStage = x.stage || 0;
			if (before) {
				if (before.has(x.name)) {
					before.delete(x.name);
					continue;
				}
				if (before.size > 0) {
					continue;
				}
			}
			if (xStage > stage) {
				continue;
			}
			i++;
			break;
		}
		this.taps[i] = item;
	}
}

Object.setPrototypeOf(Hook.prototype, null);

module.exports = Hook;
