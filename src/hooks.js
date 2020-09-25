import * as _ from "./utils";

export default class Hook {
    constructor() {
        this.hooks = {};

        this.filter = this.filter.bind(this);
        this.trigger = this.trigger.bind(this);
        this.reset = this.reset.bind(this);
    }

    reset() {
        this.hooks = {};
    }

    getHooks(hook) {
        return this.hooks[hook];
    }

    on(hook, callback, once = false) {
        if (!this.hooks[hook]) {
            this.hooks[hook] = [];
        }

        this.hooks[hook].push({callback, once});
    }

    off(hook, callback) {
        if (!this.hooks[hook]) {
            return;
        }

        const pos = _.getIndex(this.hooks[hook], {callback});

        if (pos < 0) {
            return;
        }

        delete this.hooks[hook][pos];
    }

    async filter(hook, value, ..._args) {
        if (_.isEmpty(this.hooks[hook])) {
            return value;
        }

        let pos = 0;
        for(const {once, callback} of this.hooks[hook]) {
            const args = [value, ..._args];

            value = await callback.apply(null, args);

            if (once) {
                delete this.hooks[hook][pos];
            }

            pos++;
        }

        return value;
    }

    async trigger(hook, ...args) {
        if (_.isEmpty(this.hooks[hook])) {
            return;
        }

        for(let i = 0; i < this.hooks[hook].length; i++) {
            const {once, callback} = this.hooks[hook][i];

            await callback.apply(null, args);

            if (once) {
                delete this.hooks[hook][i];
            }
        }
    }
}