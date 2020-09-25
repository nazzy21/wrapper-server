import Collection from "../collection";
import * as _ from "../utils";
import typeDefs from "./typedefs/user-meta";
import {i18n} from "../lang";

export default class UserMeta extends Collection {
	constructor() {
		super("UserMeta", {
			Id: {
				type: "Id"
			},
			userId: {
				type: "ForeignId",
				required: true,
				index: true,
				foreign: {
					key: "user_meta_id",
					name: "User",
					column: "Id",
					onDelete: "cascade",
					onUpdate: "cascade"
				}
			},
			name: {
				type: "String",
				length: 60,
				required: true
			},
			value: {
				type: "String"
			}
		}, typeDefs);
	}

	async get({name, userId}) {
		const where = {name, userId};

		const [err, metas] = await this.model().find({where});

		if (err) {
			return [err];
		}

		return metas.map( meta => {
			meta.value = _.unserialize(meta.value);

			return meta;
		});
	}

	/**
	 Sets or update meta data.
	**/
	async set(meta) {
		if (!meta.name) {
			return [_.setError(i18n("Missing meta name!"), "required_name")];
		}

		if (!meta.userId) {
			return [_.setError(i18n("Missing user id!"), "required_userId")];
		}

		// Serialize the value
		meta.value = _.serialize(meta.value);

		if (meta.Id) {
			// Do an update instead
			return this.model().update(meta, {where: {Id: meta.Id}});
		}

		const model = this.model();
		model.multi();

		let [, metas] = await this.get({userId: meta.userId});
		metas = _.indexBy(metas, "name");

		if (metas[meta.name]) {
			const oldMeta = metas[meta.name];
			meta.Id = oldMeta.Id;

			const [err] = await model.update(meta, {where: {Id: meta.Id}});
			model.end();

			if (err) {
				return [err];
			}

			// Unserialize the value again
			meta.value = _.unserialize(meta.value);

			return [null, meta];
		}

		const [err2, Id] = await model.insert(meta);
		model.end();

		if (err2) {
			return [err2];
		}

		meta.Id = Id;
		meta.value = _.unserialize(meta.value);

		return [null, meta];
	}

	unset({name, userId}) {
		const where = {userId, name};

		return this.model().delete({where});
	}

	getResolvers() {
		return {
			User: {
				meta: ({Id}) => 
					this.get({userId: Id}).then(this.response)
			},
			CurrentUser: {
				meta: ({Id}) =>
					this.get({userId: Id}).then(this.response)
			},
			getUserMeta: (__, {name, userId}) =>
				this.get({name, userId}).then(this.response),

			setUserMeta: (__, {input}) =>
				this.set(input).then(this.response),

			deleteUserMeta: (__, {name, userId}) =>
				this.unset({name, userId}).then(this.response),

			setUserMetaData: (__, {userId, input, deletable}) =>
				this.__setMetaData(userId, input, deletable)
		};
	}

	/**
	 @private
	 @callback
	**/
	async __setMetaData(userId, metas, deletable) {
		const model = this.model();
		model.multi();

		// Get insertables
		const inserts = [];

		for(const meta of metas) {
			if (!meta.Id) {
				inserts.push(meta);

				continue;
			}

			// Update meta data
			await model.update(meta, {where: {Id: meta.Id}});
		}

		if (inserts.length) {
			await model.insertMany(inserts);
		}

		if (deletable) {
			await model.delete({where: {Id: {$in: deletable}}});
		}

		const [, _metas] = await this.get({userId});
		model.end();

		return _metas||[];
	}
}