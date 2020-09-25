import multer from "multer";
import path from "path";
import {mkDir, readDir} from "../filesystem";

export default class Uploader {
	constructor(uploadPath) {
		this.basePath = uploadPath;
		this.currentPath = null;
		this.currentFile = null;

		const storage = multer.diskStorage({
			destination: this.moveUploadedTo.bind(this),
			filename: this.filename.bind(this)
		});

		this.uploader = multer({storage});
	}

    async filename(req, file, cb) {
        let name = file.originalname,
            ext = name.substring(name.lastIndexOf("."));

        // Check existing file
        const [err, files] = await readDir(this.currentPath);

        if (err || !files.length) {
            return cb(null, name);
        }

        let count = 0,
            pattern = new RegExp(`^${name.replace(ext, "")}`);

        for(const filePath of files) {
            let fileName = filePath.replace(this.currentPath, "");
            fileName = fileName.replace(/\\/g, "");

            if (fileName.match(pattern)) {
                count++;
            }
        }

        if (count > 0) {
            name = name.replace(ext, `-${count}${ext}`);
        }

        cb(null, name);
    }

	async moveUploadedTo(req, file, cb) {
        const date = new Date(),
            year = date.getFullYear(),
            month = date.getMonth();

        const dir = this.basePath;

        // Create year folder
        const [err] = await mkDir(path.resolve(dir, `./${year}`));

        if (err && 'EEXIST' !== err.code) {
            // log error
            return err;
        }

        // Create month folder
        const [err2] = await mkDir(path.resolve(dir, `./${year}/${month}`));

        if (err2 && 'EEXIST' !== err2.code) {
            return err2;
        }

        this.currentPath = path.resolve(dir, `./${year}/${month}`);

        cb(null, this.currentPath);
    }

    getSingleFile(name, req, res) {
        const single = this.uploader.single(name);

        return new Promise(resolve => {
            single(req, res, err => {
                if (err) {
                    resolve([err]);

                    return err;
                }

                resolve([null, req.file]);

                return err;
            });
        });
    }

    getFiles(name, req, res) {
        const list = this.uploader.array(name, 5);

        return new Promise( resolve => {
            list(req, res, err => {
                if (err) {
                    resolve([err]);

                    return err;
                }

                resolve([null, req.files]);

                return err;
            })
        });
    }
}