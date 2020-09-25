import readLine from "readline";
import * as _ from "./utils";
import path from "path";

/**
 * Sets a series of questions in command line.
 *
 * @param {object} questions {
 *     @property $Keys                              The name of a question.
 *     @type {string} message                       The question message to ask to.
 *     @type {string} desc                          A short description pertaining the question.
 *     @type {*} value                              The default value set to a question when no answer is set.
 *     @type {boolean} required                     Set to true to require an answer input.
 * }
 * @param {object} data
 * @returns {*}
 * @constructor
 */
export function Prompt(questions, data) {
    let names = _.keys(questions);

    const getNext = () => {
        if (!names.length) {
            return data;
        }

        let name = names.shift(),
            q = questions[name];

        q = _.isObject(q) ? q : {message: q};

        let {message, required, value, desc} = q;

        return Question({question: message, name, data, required, value, desc}).then(getNext);
    };

    return getNext();
}

export function Question({question, name, data, required, value, desc}) {
    let reader = getReader(),
        q = [question];

    if (desc) {
        q.push(`(${desc})`);
    }

    if (value) {
        q.push(`[ ${value} ]> `);
    } else {
        q.push('> ');
    }

    return new Promise( res => {
        reader.question("\n\r" + q.join("\n\r"), answer => {
            answer = answer.trim();
            answer = answer || value;

            res(answer);
        });
    })
        .then( answer => {
            reader.close();

            if (!answer && required) {
                return Question({question, name, data, required, value, desc});
            }

            data[name] = answer;

            return answer;
        });
}

/**
 * A helper method to set a progress indicator.
 *
 * @param {string} label
 * @param {int} start
 * @param {string} unit
 * @returns {{end(*=): void}}
 * @constructor
 */
function Progress(label, start = 1, unit = '%') {
    const out = getReader();

    let str = start => `${label}: ${start}${unit}`,
        count = start;

    process.stdout.write(str(start));

    let timer = setInterval( () => {
        clearLine();
        process.stdout.write(str(count));

        count++;

        if (count > 100) {
            // Reset counter
            count = 1;
        }
    }, 300);

    return {
        end(str) {
            clearInterval(timer);
            clearLine();

            str = str || 'Completed';
            str += "\n\r";

            process.stdout.write(`${label}: ${str}`);
            out.close();
        }
    };
}

export function getArgs(args) {
    const params = {};

    args.map( arg => {
        if (arg.match(/^(--|-)/)) {
            return;
        }

        let a = arg.split('=');

        params[a[0]] = a[1]||true;
    });

    return params;
}

export function getFlags(args) {
    const flags = {};

    args.map( arg => {
        if (!arg.match(/^--/)) {
            flags[arg] = arg;
            return;
        }

        const flag = arg.replace("--", ""),
            a = flag.split("=");

        flags[a[0]] = a[1]||true;
    });

    return flags;
}

function getReader() {
    return readLine.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function clearLine() {
    readLine.clearLine(process.stdout, 0);
    readLine.cursorTo(process.stdout, 0);
}