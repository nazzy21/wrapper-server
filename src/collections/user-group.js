import Collection from "../collection";
import typeDefs from "./typedefs/user-group";
import * as _ from "../utils";
import {i18n} from "../lang";

export default class UserGroup extends Collection {
	constructor() {
		super("UserGroup", {
			Id: {
				type: "Id"
			},
			name: {
				type: "String",
				length: 60,
				required: true,
				unique: true
			},
			slug: {
				type: "String",
				length: 120,
				required: true,
				index: true
			},
			description: {
				type: "String",
				length: 255
			},
			caps: {
				type: "Array"
			}
		}, typeDefs);
	}

	/**
	 Get the user group's data base on column name.

	 @param {string} column
	 	The name of the group's column to use as base for retrieving the data. Allowed columns are `Id` and `slug`.
	 @param {*} value
	 	The corresponding value of the given column name.
	 @returns {Promise<[Error, Object]>}
	**/
	async getBy(column, value) {
		if (!_.contains(["Id", "slug"], column)) {
			return [_.setError(i18n("Invalid column name!"), "invalid_column")];
		}

		const where = {};
		where[column] = value;

		return this.model().findOne(false, where);
	}

	/**
	 Returns the group data base on the given id.

	 @param {int} groupId
	 @returns {Promise<[Error, Object]>}
	**/
	get(groupId) {
		return this.getBy("Id", groupId);
	}

	/**
	 Creates new user group in the database.

	 @param {object} group
	 	{
			@property {string} name
			@property {string} description
			@property {array} caps
				The list of user capabilities allowed of the group.
	 	}
	 @returns {Promise<[Error, Object]>}
	**/
	async create(group) {
		if (!group.name) {
			return [_.setError(i18n("Group name is required!"), "require_name")];
		}

		group.slug = _.toSlug(group.name);

		const model = this.model();
		model.multi();

		const [err, Id] = await model.insert(group);

		if (err) {
			model.end();

			return [err];
		}

		const [err2, groupData] = await this.get(Id);
		model.end();

		/**
		 Trigger to call the hooks attached to group creation.

		 @param {object} groupData
		 @param {object} group
		**/
		await this.trigger("create", groupData, group);

		return [null, groupData];
	}

	/**
	 Update user's group in the database.

	 @param {object} group
	 	{
	 		@property {int} Id
	 			Required. The id of the group to update to.
			@property {string} name
			@property {string} description
			@property {array} caps
				The list of user capabilities allowed of the group.
	 	}
	**/
	async update(group) {
		if (!group.Id) {
			return [_.setError(i18n("Cannot update none existent group!"), "invalid_id")];
		}

		// Update group slug base on group name
		if (group.name) {
			group.slug = _.toSlug(group.name);
		}

		const model = this.model();
		model.multi();

		const [err] = await model.update(group, {where: {Id: group.Id}});

		if (err) {
			model.end();

			return [err];
		}

		const [err2, groupData] = await this.get(group.Id);
		model.end();

		if (err2) {
			return [err2];
		}

		/**
		 Trigger to call all hooks attached to group update.

		 @param {object} groupData
		 @param {object} group
		**/
		await this.trigger("update", groupData, group);

		return [null, groupData];
	}

	/**
	 Removes user group from the database.

	 @param {int} groupId
	 	The id of the group to remove to.
	 @param {string} action
	 	The action to take for user's belonging to the group.
	 @param {*} value
	 	The corresponding value need to perform the set action.
	 @returns {Promise<[Error, Boolean]>}
	**/
	async delete(groupId, action = false) {
		if (!groupId) {
			return [_.setError(i18n("Invalid group id!"), "invalid_id")];
		}

		const model= this.model();
		model.multi();

		const [err, group] = await this.get(groupId);

		if (err) {
			model.end();

			return [err];
		}

		const [err2, done] = await model.delete({where: {Id: groupId}});
		model.end();

		if (err2) {
			return [err2];
		}

		/**
		 Trigger to allow handling the data relating to the group.

		 @param {object} group
		 	The group deleted from the database.
		 @param {string} action
		 	The action that must be taken when deleting the group.
		**/
		await this.trigger("delete", group, action);

		return [null, done];
	}

	/**
	 Get the list of user group in the database.

	 @returns {Promise<[Boolean, Array]>}
	**/
	find() {
		return this.model().find();
	}

	/**
	 @private
	**/
	getResolvers() {
		return {
			User: {
				caps: ({group}) => 
					this.__getGroupColumn(group, "caps"),

				groupId: ({group}) => 
					this.__getGroupColumn(group, "Id"),

				groupName: ({group}) =>
					this.__getGroupColumn(group, "name"),

				groupSlug: ({group}) =>
					this.__getGroupColumn(group, "slug")
			},

			CurrentUser: {
				caps: ({group}) => 
					this.__getGroupColumn(group, "caps"),

				groupId: ({group}) => 
					this.__getGroupColumn(group, "Id"),

				groupName: ({group}) =>
					this.__getGroupColumn(group, "name"),

				groupSlug: ({group}) =>
					this.__getGroupColumn(group, "slug")
			},

			getUserGroup: (__, {Id, slug}) =>
				Id && this.get(Id).then(this.response) || slug && this.getBy("slug", slug).then(this.response),

			getUserGroups: () => 
				this.find().then(this.response),

			createUserGroup: (__, {input}) =>
				this.create(input).then(this.response),

			updateUserGroup: (__, {input}) =>
				this.update(input).then(this.response),

			deleteUserGroup: (__, {Id, action}) =>
				this.delete(Id, action).then(this.response)
		};
	}

	/**
	 @private
	 @callback
	**/
	async __getGroupColumn(group, column) {
		const [, groupData] = await this.get(group);

		return groupData && groupData[column];
	}
}