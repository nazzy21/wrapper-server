import Collection from "../collection";
import typeDefs from "./typedefs/settings";
import {gqlDirective} from "@wrapper/gql-server";
import * as _ from "../utils";
import {i18n} from "../lang";

/**
 The application setting class.
 Use to transact in the database for and in the application's settings. Also sets and provides corresponding
 response on GraphQL request queries.

 GraphQL Queries
 	getConfig(client: String platform: Object server: String): Config
 	getSetting(name: String autoload: Boolean): [Setting]

 GraphQL Mutation
 	setSetting(input: SettingInput): Boolean
 	deleteSetting(name: String!): Boolean
**/
export default class AppSettings extends Collection {
	constructor() {
		super("AppSettings", {
			name: {
				type: "String",
				length: 60,
				primary: true
			},
			value: {
				type: "String",
				long: true
			},
			autoload: {
				type: "Boolean"
			}
		}, typeDefs);
	}

	/**
	 Sets or updates setting in the database.

	 @param {string} name
	 	Required. The name of the setting to set or update to.
	 @param {*} value
	 	The corresponding value of the given setting name.
	 @param {boolean} autoload
	 	Whether the setting should be autoloaded.
	 @returns {Promise<[Error, Boolean]>}
	**/
	async set(name, value, autoload = false) {
		const model = this.model();
		model.multi();

		const data = {name, value, autoload},
			[err, oldValue] = await model.getValue("value", {name});

		if(err) {
			model.end();

			return [err];
		}

		if (oldValue) {
			// Do an update
			const res = await model.update(data, {name});
			model.end();

			return res;
		}

		const res2 = await model.insert(data);
		model.end();

		return res2;
	}

	/**
	 Get settings from the database.

	 @param {string} name
	 	Optional. The name of the settings to get to.
	 @param {boolean} autoload
	 	Optional. If true, will retrieve all autoloaded settings.
	 @return {Promise<[Error, Array<Object>]>}
	**/
	get(name, autoload = false) {
		const where = {name};

		if (autoload) {
			where.autoload = autoload;
		}

		return this.model().find({where});
	}

	/**
	 Remove setting in the database.

	 @param {string} name
	 	The name of the settings to remove to.
	 @returns {Promise<[Error, Boolean]>}
	**/
	delete(name) {
		return this.model().delete({name});
	}

	/**
	 @private
	 @callback
	**/
	getResolvers() {
		return {
			Config: {
				templates: ({sessionId, client}) =>
					this.serverData.getTemplates(client),

				settings: ({sessionId}) =>
					this.__getSettings.bind(this)
			},
			// Simply pass the parameters
			getConfig: (__, params) => params,

			getSetting: (__, {name, autoload}) =>
				this.get(name, autoload).then(this.response),

			setSetting: (__, {name, value, autoload}) =>
				this.set(name, value, autoload).then(this.response),

			deleteSetting: (__, {name}) =>
				this.delete(name).then(this.response)
		};
	}

	/**
	 @private
	 @callback
	**/
	getDirectives() {
		return [
			gqlDirective({
				name: "sessionId",
				locations: ["FIELD", "OBJECT"],
				strict: true,
				isBefore: true,
				resolve: this.__validateSessionId.bind(this)
			}),
			gqlDirective({
				name: "clientId",
				locations: ["FIELD"],
				strict: true,
				isBefore: true,
				resolve: this.__validateClientId.bind(this)
			})
		];
	}

	/**
	 @private
	 @callback
	**/
	async __validateSessionId(__, {clientId, client}, {screen}) {
		if (clientId) {
			// Client ID?
			return true;
		}
		
		const sessionId = await screen.getSessionId();

		if (!sessionId) {
			return _.setError(i18n("Access Denied!"), "access_denied");
		}

		return true;
	}

	/**
	 Validates clientId pass on graphql request query.

	 @private
	 @callback
	**/
	async __validateClientId({clientId}, __, {screen}) {
		const isValid = await screen.isValidClientId(clientId);

		if (!isValid) {
			return _.setError(i18n("Access Denied!"), "access_denied");
		}

		return true;
	}

	/**
	 @private
	 @callback
	**/
	async __getSettings() {
		const [err, settings] = await this.get(false, true),
			setObj = {};

		if (err || _.isEmpty(settings)) {
			return setObj;
		}

		for(const setting of settings) {
			setObj[setting.name] = setting.value;
		}

		return setObj;
	}
}