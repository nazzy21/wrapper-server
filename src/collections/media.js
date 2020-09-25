import Collection from "../collection";
import typeDefs from "./typedefs/media";
import Uploader from "../screens/uploader";
import * as _ from "../utils";
import {i18n} from "../lang";

export default class Media extends Collection {
	constructor() {
		super("Media", {
			Id: {
				type: "Id"
			},
			name: {
				type: "String",
				length: 160,
				required: true
			},
			type: {
				type: "String",
				length: 40,
				required: true
			},
			file: {
				type: "Object",
				required: true
			},
			sizes: {
				type: "Object"
			},
			createdAt: {
				type: "DateTime",
				defaultValue: "DateTime"
			},
			uploadedBy: {
				type: "String",
				required: true
			}
		}, typeDefs);
	}

	resolvers() {
		return {
			uploadFile: (__, params, {screen}) =>
				this.__uploadFile(params, screen),

			uploadFiles: (__, params, {screen}) =>
				this.__uploadFiles(params, screen),

			getFile: (__, params, {screen}) =>
				this.__getFile(params, screen),

			mediaQuery: (__, params, {screen}) => 
				this.query(params)
		}
	}

	async create(media) {
		const {name, file} = media;

		if (!name || !file || _.isEmpty(file)) {
			return [_.setError(i18n("Empty file!"), "empty_file")];
		}

		const model = this.model();
		model.multi();

		const [err, Id] = await model.insert(media);

		if (err) {
			model.end();

			return [err];
		}

		const [err2, fileData] = await this.get(Id);
		model.end();

		return [err2, fileData];
	}

	update(media) {}

	delete(Id) {}

	get(Id) {
		if (!Id) {
			return [_.setError(i18n("Missing file ID!"), "missing_id")];
		}

		return this.model().findOne(false, {Id});
	}

	async query(query) {
		query = query || {};

		const cond = {},
			where = {};

		if (query.type) {
			where.type = {$like: `${query.type}*`};
		}

		const model = this.model();
		model.multi();

		// Get total count
		const [err, types] = await model.find({column: "type", where}),
			result = {foundItems: 0, typeCount: {}, media: []};

		if (err || !types || !types.length) {
			model.end();

			return result;
		}

		for(const {type} of types) {
			if (!result.typeCount[type]) {
				result.typeCount[type] = 0;
			}
			result.typeCount[type] += 1;
			result.foundItems += 1;
		}

		// Get media
		const {page, perPage} = query;

		if (page || perPage) {
            cond.page = page||1;
            cond.perPage = perPage||25;
        }
        cond.where = where;

        const [err2, media] = await model.find(cond);
        model.end();

        result.media = media;

        return result;
	}

	onLoad() {
		// Listen to media usage on different object
		this.serverData.on("usedMedia", this.__usedMedia.bind(this));
	}

	__usedMedia(Id) {}

	/**
	 @private
	 @callback
	**/
	async __uploadFile({name, save, crop}, screen) {
		const uploader = new Uploader(this.serverData.uploadPath),
			[err, file] = await uploader.getSingleFile(name, screen.req, screen.res);

		if (err) {
			return _.setError(i18n("Something went wrong. Unable to upload file!"), "failed_upload");
		}

		const fileData = await this.__getFileData(file, crop, screen);

		if (save) {
			const [err2, _file] = await this.create(fileData);

			if (err2) {
				// Delete file
				return err2;
			}

			return _file;
		}

		return fileData;
	}

	async __uploadFiles({name, save, crop}, screen) {
		const uploader = new Uploader(this.serverData.uploadPath),
			[err, files] = await uploader.getFiles(name, screen.req, screen.res);

		if (err) {
			return [];
		}

		const list = [];

		for(const file of files) {
			const fileData = await this.__getFileData(file, crop, screen);

			if (save) {
				const [err2, _file] = await this.create(fileData);

				if (err2) {
					list.push(err2);
				} else {
					list.push(_file);
				}

				continue;
			}

			list.push(fileData);
		}

		return list;
	}

	async __getFileData(file, crop, screen) {
		const fileObj = {
				name: file.filename,
				size: file.size,
				type: file.mimetype
			};

		let filePath = file.path.replace(this.serverData.uploadPath, "");

		// Clean-up double slashes
		const slash = new RegExp("\\\\", "g");

		filePath = filePath.replace(slash, "/");
		fileObj.path = filePath;

		const sizes = {};

		if (crop && !_.isEmpty(crop)) {

		}

		const fileData = {
			name: file.filename,
			type: file.mimetype,
			file: fileObj,
			uploadedBy: screen.currentUser.userId,
			sizes
		}

		return fileData;
	}

	/**
	 @private
	 @callback
	**/
	__getFile({fileId, filePath}, screen) {}
}