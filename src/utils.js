import * as _ from "underscore";

_.extend(_, {
    DayInSeconds: 86400,
    DayInMilliSeconds: 24 * 8.64e+7,
    DayInMicroSeconds: 86400 * 6000,
    HourInSeconds: 60 * 60,
    HourInMicroSeconds: 60 * 60 * 6000,
    HourInMilliSeconds: 3.6e+6,
    MinuteInSeconds: 60,
    MinuteInMicroSeconds: 60 * 6000,
    isDefined,
    isUndefined,
    isEmail,
    define,
    serialize,
    unserialize,
    devAssert,
    setError,
    toSlug,
    isEmpty,
    sumOf
});

module.exports = _;

function isDefined(obj, name) {
    return obj && !!obj[name];
}

function isUndefined(value) {
    return 'undefined' === typeof value;
}

function isEmail(email) {
    let atPos = email.indexOf('@'),
        dotPos = email.indexOf('.');

    return atPos && dotPos && dotPos > (atPos+2);
}

function isEmpty(value) {
    if ("" === value || _.isNull(value) || _.isUndefined(value)) {
        return true;
    }

    if (_.isArray(value) && !value.length) {
        return true;
    }

    if (_.isObject(value) && !Object.keys(value).length) {
        return true;
    }

    return false;
}

function define(obj, name, value) {
    if (_.isObject(name)) {
        return Object.keys(name).map( key => define(obj, key, name[key]));
    }

    if (isDefined(obj, name)) {
        return true;
    }

    if (_.isFunction(value)) {
        value = value.bind(obj);
    }

    Object.defineProperty(obj, name, {value: value});
}

function serialize(value) {
    try {
        return JSON.stringify(value);
    } catch(e) {
        return value;
    }
}

function unserialize(value) {
    try {
        return JSON.parse(value);
    } catch(e) {
        return value;
    }
}

function devAssert(condition, message) {
    if (_.isBoolean(condition) && !condition) {
        throw new Error(message);
    }

    if (!condition) {
        throw new Error(message);
    }
}

function setError(message, code) {
    const err = new Error(message);
    err.code = code;

    // todo: Log error

    return err;
}

function toSlug(str) {
    let slug = str.toLowerCase().replace(/[ '`"*&^%$#@!<>\/]/g, '-');

    // Check of -- duplicate
    slug = slug.replace(/----|---|--/g, "-");

    return slug;
}

function sumOf(arr) {
    return arr.reduce((a, b) => (a||0)+(b||0), 0);
}