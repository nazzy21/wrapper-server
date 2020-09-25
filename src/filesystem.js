import fs from "fs";
import path from "path";
import * as _ from "./utils";

export function mkDir(dir, options = {}) {
    return new Promise( res => {
        fs.mkdir( dir, options, err => {
            if( err ) {
                return res([err]);
            }

            res([null, true]);
        });
    });
}

export function writeFile(filename, data, options = {}) {
    return new Promise( res => {
        fs.writeFile( filename, data, options, err => {
            if ( err ) {
                res([err]);
            }

            res([null, true]);
        });
    });
}

export function readDir(dir) {
    return new Promise( res => {
        let list = [];

        fs.readdir( dir, async (err, files) => {
            if (err) {
                return res([err]);
            }

            for(const file of files) {
                const fileName = path.resolve(dir, file),
                    data = path.parse(fileName),
                    ext = data.ext,
                    isDir = !ext || ext.match(/\./);

                if (isDir) {
                    let [, subFiles] = await readDir(fileName);

                    if (!_.isEmpty(subFiles)) {
                        list = list.concat(subFiles);
                    }
                }

                list.push(fileName);
            }

            res([null, list]);
        });
    });
}

export function readFile(filename, options = {encoding: 'utf8'}) {
    return new Promise( res => {
        fs.readFile(filename, options, (err, data) => {
            if (err) {
                res([err]);
            }

            res([null, data]);
        });
    });
}