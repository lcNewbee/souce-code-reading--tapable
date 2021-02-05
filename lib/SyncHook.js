/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Hook = require("./Hook");
const HookCodeFactory = require("./HookCodeFactory");

class SyncHookCodeFactory extends HookCodeFactory {
	// 该函数用来生成this.compile的函数体代码；compile的意思是编译，编译的结果是生成了一个函数
	// 如果是sync类型hook，该函数就是call方法，async类型则是callAsync，promise则是promise方法
	// 也就是生成了执行hook插件列表的函数
	content({ onError, onDone, rethrowIfPossible }) {
		return this.callTapsSeries({
			onError: (i, err) => onError(err),
			onDone,
			rethrowIfPossible
		});
	}
}

const factory = new SyncHookCodeFactory();

const TAP_ASYNC = () => {
	throw new Error("tapAsync is not supported on a SyncHook");
};

const TAP_PROMISE = () => {
	throw new Error("tapPromise is not supported on a SyncHook");
};

const COMPILE = function(options) {
	factory.setup(this, options);
	return factory.create(options);
};

function SyncHook(args = [], name = undefined) {
	const hook = new Hook(args, name);
	hook.constructor = SyncHook;
	hook.tapAsync = TAP_ASYNC;
	hook.tapPromise = TAP_PROMISE;
	// compile方法生成调用hook插件的call/callAsync/promise方法
	hook.compile = COMPILE;
	return hook;
}

SyncHook.prototype = null;

module.exports = SyncHook;
