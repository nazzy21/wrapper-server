import * as _ from "./utils";

export default class Cache {
    constructor() {
        this.cached = {};
    }

    createKey(key) {
        return _.serialize(key);
    }

    add(key, value) {
        this.cached[key] = value;
    }

    clear(key = null) {
        if (key) {
            if (!this.cached[key]) {
                return;
            }

            delete this.cached[key];
        }

        this.cached = {};
    }

    get(key) {
        return this.cached[key] ?? null;
    }
}