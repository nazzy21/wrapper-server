import Collection from "../collection";
import * as _ from "../utils";
import {randomSalt, isHashKey, generateHashKey, decryptHashKey} from "../hash";
import {i18n} from "../lang";
import {gqlDirective} from "@wrapper/gql-server";
import typeDefs from "./typedefs/user";

export default class User extends Collection {
	constructor() {
		super("User", {
			Id: {
				type: "Id"
			},
			login: {
				type: "String",
				length: 20,
				required: true,
				unique: true,
				index: true
			},
			email: {
				type: "String",
				length: 120,
				required: true,
				unique: true,
				index: true
			},
			pass: {
				type: "String",
				length: 220,
				required: true
			},
			group: {
				type: "ForeignId"
			},
			status: {
		        type: 'Enum',
		        enum: ['active', 'inactive', 'blocked', 'pending'],
		        defaultValue: 'pending'
		    },
		    createdAt: {
		        type: 'DateTime',
		        defaultValue: 'DateTime'
		    },
		    updatedAt: {
		        type: 'DateTime',
		        update: true
		    }
		}, typeDefs);
	}

	/**
     Get user base on the given column name and value.

     @param {string} column
        The name of the column. Options are `Id`, `login`, and `email`
     @param {*} value
        The corresponding value of the specified column.

     @returns {Array<[Error, userData]>}
    **/
    async getBy(column, value) {
        const allowed = ["Id", "login", "email"];

        if (!_.contains(allowed, column)) {
            return [_.setError(i18n("Invalid column name!"), "invalid_column")];
        }

        const where = {};
        where[column] = value;

        let [err, user] = await this.model().findOne(false, where);

        if (err || _.isEmpty(user)) {
            return [_.setError(i18n('User does not exist!'),'not_exist')];
        }

        return [null, user];
    }

    /**
     Get user's data from the database.

     @param {int} Id
     @returns {Promise<[Error, Object]>}
    **/
    get(Id) {
    	return this.getBy("Id", Id);
    }

	/**
	 Creates new user in the database.

	 @param {object} userData
	 	{
			@property {string} login
				The unique login name of the user.
			@property {string} email
				The email address of the created user.
			@property {string} pass
				The unique password string use to verify the user's account.
			@property {int} group
				The Id of the group the user belongs to.
			@property {string} status
				The status the user have.
	 	}
	  @param {boolean} isSilent
	  	Whether to create the user without triggering any hooks.

	  @returns {Promise<[Error, Object]>}
	**/
	async create(userData, isSilent = false) {
		if (!userData.login) {
            return [_.setError(i18n("User login is required!"), "missing_login")];
        }

        if (!userData.pass) {
            return [_.setError(i18n("Set user password!"), "missing_password")];
        }

        if (!userData.email || !_.isEmail(userData.email)) {
            return [_.setError(i18n("Invalid email address!"), "invalid_email")];
        }

        const model = this.model();
        // Do a multiple transaction
        model.multi();

        const where = [{email: userData.email}, {login: userData.login}],
			[err, otherUsers] = await model.find({where: {$or: where}});

		if (err) {
			model.end();

			return [this.serverError()];
		}

		for(const user of otherUsers) {
			// Check for duplicate email
			if (_.isEqual(user.email, userData.email)) {
				model.end();

				return [_.setError(i18n("Email already exist!"), "email_exist")];
			}

			// Check for dupliate login
			if (_.isEqual(user.login, userData.login)) {
				model.end();

				return [_.setError(i18n("Username already in use!"), "login_exist")];
			}
		}

        const [err2, hash] = await generateHashKey(userData.pass);

        if (err2) {
        	model.end();

        	return [err2];
        }

        userData.pass = hash;

        const [err3, userId] = await model.insert(userData);

        if (err3) {
        	model.end();

        	return [err3];
        }

        const [err4, newUser] = await this.getBy("Id", userId);
        model.end();

        if (err4) {
        	return [err4];
        }

        if (!isSilent) {
        	/**
        	 Calls all hooks for new user insertion.

        	 @param {object} newUser
        	 	An object containing the data of the newly created user.
        	 @param {object<User>} User
        	 	The class instance.
        	**/
        	await this.trigger("create", newUser, this);
        }

        return [null, newUser];
	}

	/**
	 Updates user's data in the database.

	  @param {object} userData
	 	{
	 		@property {int} Id
	 			Required. The user's unique id to update the data to.
			@property {string} login
				The unique login name of the user.
			@property {string} email
				The email address of the created user.
			@property {string} pass
				The unique password string use to verify the user's account.
			@property {int} group
				The Id of the group the user belongs to.
			@property {string} status
				The status the user have.
	 	}
	  @param {boolean} isSilent
	  	Whether to create the user without triggering any hooks.

	  @returns {Promise<[Error, Object]>}
	**/
	async update(userData, isSilent = false) {
		if (!userData.Id) {
			return [_.setError(i18n("Cannot update none existent user!"), "invalid_id")];
		}

		const model = this.model();
		model.multi();

		const where = {Id: userData.Id, $or: [
				{email: userData.email},
				{login: userData.login}
			]},
			[err, otherUsers] = await model.find({where: {$or: where}});

		if (err) {
			model.end();

			return [this.serverError()];
		}

		for(const user of otherUsers) {
			// Check for duplicate email
			if (_.isEqual(user.email, userData.email)) {
				model.end();

				return [_.setError(i18n("Email already exist!"), "email_exist")];
			}

			// Check for dupliate login
			if (_.isEqual(user.login, userData.login)) {
				model.end();

				return [_.setError(i18n("Username already in use!"), "login_exist")];
			}
		}

		// Maybe hash password?
		if (!isHashKey(userData.pass)) {
			// Re-hash password
			const [err2, hash] = await generateHashKey(userData.pass);

			if (err2) {
				model.end();

				return [this.serverError()];
			}

			userData.pass = hash;
		}

		const [err3] = await model.update(userData, {where: {Id}});

		if (err3) {
			model.end();

			return [this.serverError()];
		}

		const [err4, updatedUser] = await this.getBy("Id", userData.Id);
		model.end();

		if (err4) {
			return [this.serverError()];
		}

		if (!isSilent) {
			await this.trigger("update", updatedUser, this);
		}

		return [null, updatedUser];
	}

	/**
	 Remove user from the database.

	 @param {int} Id
	 	The user's id to delete to.
	 @param {boolean} isSilent
	 	Whether to remove the user in complete silence.
	 @returns {Promise<[Error, Boolean]>}
	**/
	async delete(Id, isSilent = false) {
		if (!Id) {
			return [_.setError(i18n("Cannot delete none existent user!"), "invalid_id")];
		}

		const model = this.model();
		model.multi();

		// Get user's data
		const [err, user] = await this.get(Id);

		if (err) {
			model.end();

			return [err];
		}

		const [err2, done] = await model.delete({where: {Id}});
		model.end();

		if (!isSilent) {
			await this.trigger("delete", user);
		}

		return [null, done];
	}

	/**
	 Get users from the database.

	 @param {object} query
	 	{
			@property {string} search
			@property {int} group
			@property {array<int>} groupIn
			@property {string} status
			@property {array<string>} statusIn
			@property {int} page
			@property {int} perPage
	 	}
	 @returns {Promise<[Error, Array<Object|Int>]>}
	**/
	async find(query={}) {
		query = query || {};

		const where = {};

		// Add search query
		if (query.search) {
			// Search in login or email
			where.$or = [
				{login: {$like: `*${query.search}*`}},
				{email: {$like: `*${query.search}*`}}
			];
		}

		// Find by group
		if (query.group) {
			where.group = query.group;
		} else if (query.groupIn) {
			where.group = {$in: query.groupIn};
		}

		// Find by status
		if (query.status) {
			where.status = query.status;
		} else if (query.statusIn) {
			where.status = {$in: query.statusIn};
		}

		let columns = query.columns||"*";

		// Get other conditions
		const {page, perPage, orderBy, order} = query,
			conds = {where, page, perPage, orderBy, order};

		const [, usersData] = await this.model().find(conditions),
			results = {where};

		results.users = usersData;

		// If a column is an `Id`, return the list of ids instead
		if (query.column && "Id" === query.column) {
			const users = [];

			for(const user of usersData) {
				users.push(user.Id);
			}

			results.users = users;
		}

		return results;
	}

	getResolvers() {
		return {
			UserResults: {
				foundUsers: ({where}) =>
					this.model().count("Id", where),

				statuses: ({where}) =>
					this.__countUserByStatus(where),

				userCount: () => this.model().count("Id"),

				statusCount: () => this.__countUserByStatus()
			},

			// Listen to user group object
			UserGroup: {
				userCount: ({Id}) =>
					this.model().count("Id", {group: Id}),
				userStatusCount: ({Id}) =>
					this.__countUserByStatus({group: Id})
			},

			getCurrentUser: (__, {}, {screen}) => 
				screen.currentUser,

			getUser: (__, {Id}) =>
				this.get(Id).then(this.response),

			getUserBy: (__, {column, value}) =>
				this.getBy(column, value).then(this.response),

			getUsers: (__, params) => 
				this.find(params).then(results => results.users),

			userQuery: (__, params) =>
				this.find(params),

			createUser: (__, {input, isSilent}) =>
				this.create(input, isSilent).then(this.response),

			updateUser: (__, {input, isSilent}) =>
				this.update(input, isSilent).then(this.response),

			deleteUser: (__, {Id, isSilent}) =>
				this.delete(Id, isSilent).then(this.response),

			login: (__, {usr, pwd, client, platform}, {screen}) =>
				this.__login({usr, pwd, client, platform}, screen),

			logout: (__, {client, platform}, {screen}) => this.__logout({client, platform}, screen),

			forgotPassword: (__, ___, {screen}) =>
				this.__forgotPassword(screen),

			userStatusCount: () =>
				this.__countUserByStatus()
		};
	}

	getDirectives() {
		return [
			gqlDirective({
				name: "user",
				locations: ["FIELD"],
				strict: true,
				isBefore: true,
				resolve: this.__validateUser.bind(this)
			}),
			gqlDirective({
				name: "permission",
				locations: ["FIELD"],
				strict: true,
				isBefore: true,
				resolve: this.__validatePermission.bind(this)
			})
		];
	}

	onLoad(server) {
		// Check current logged in user
		server.on("getSessionId", this.__getCurrentUser.bind(this));

		// Maybe delete user?
		const userGroup = server.getCollection("UserGroup");

		userGroup.on("delete", this.__maybeDeleteUsers.bind(this));
	}

	/**
	 @private
	 @callback
	**/
	__validateUser({user}, __, {screen}) {
		const currentUser = screen.currentUser,
			isLoggedIn = screen.isUserLoggedIn();

		if ("guest" === user && isLoggedIn) {
			return new Error("Access Denied");
		}

		if ("login" === user && !isLoggedIn) {
			return new Error("Require login!");
		}

		return true;
	}

	/**
	 @private
	 @callback
	**/
	__validatePermission({permission}) {}

	/**
	 @private
	 @callback
	**/
	async __getCurrentUser(sessionId, screen) {
		if (!screen.session || !screen.session.userId) {
			return sessionId;
		}

		if (screen.currentUser && screen.currentUser.Id === screen.session.userId) {
			return sessionId;
		}

		const [err, user] = await this.get(screen.session.userId);

		if (user) {
			screen.currentUser = user;
		}

		return sessionId;
	}

	async __countUsers(where = false) {
		return this.model().getValue({$fn: {column: "Id"}});
	}

	/**
	 @private
	 @callback
	**/
	async __countUserByStatus(where = false) {
		const [err, users] = await this.model().find({column: "status", where}),
			statuses = {};

		for(const {status} of users) {
			if (!statuses[status]) {
				statuses[status] = 0;
			}
			statuses[status] += 1;
		}

		return statuses;
	}

	async __login({usr, pwd, client, platform}, screen) {
		/**
		 Check if user is able to login.
		**/
		const canLogin = await this.filter("preUserLogin", true, {usr, pwd}, screen);

		if (_.isError(canLogin)) {
			// Bail if user is unable to login.
			return canLogin;
		}

		const column = _.isEmail(usr) ? "email" : "login",
			[err, user] = await this.getBy(column, usr);

		if (err) {
			if ("not_exist" === err.code) {
				return _.setError(i18n("Invalid username and/or password!"), "invalid_login");
			}

			return this.serverError();
		}

		if (!user) {
			return _.setError(i18n("Invalid credentials! Are you sure you are currently registered?"), "invalid_login");
		}

		const [err2, pass] = await decryptHashKey(user.pass);

		if (err2) {
			return this.serverError();
		}

		if (pwd !== pass) {
			return _.setError(i18n("Incorrect password!"), "invalid_password");
		}

		/**
		 Trigger to mark that the user is logged in to the system.

		 @param {object} user
		 @param {object} screen
		**/
		await this.trigger("login", user, {client, platform}, screen);

		return user;
	}

	async __logout(params, screen) {
		const user = screen.currentUser,
			sessionId = await screen.getSessionId();

		let pos = 0,
			newSessionId = sessionId;

		for(const {once, callback} of this.getHooks("logout")) {
            newSessionId = await callback.call(null, newSessionId, user, params, screen);

            if (once) {
                delete this.hooks[hook][pos];
            }

            pos++;

            if (_.isError(newSessionId)) {
            	// Don't bother calling the other hooks
            	return newSessionId;
            }
		}

		return newSessionId;
	}

	__forgotPassword(screen) {}

	/**
	 @private
	 @callback
	**/
	async __maybeDeleteUsers(group, action, value) {
		if (!action) {
			return; // Nothing to be done
		}

		// Get user's ids
		const [, ids] = await this.find({columns: "Id", group});

		if (!ids || _.isEmpty(ids)) {
			return;
		}

		for(const Id of ids) {
			switch(action) {
				case "delete" :
					// Delete all users
					await this.delete(Id);
					break;

				case "move" :
					// Assumes moving to a different group
					const groupId = parseInt(value);

					if (!_.isNaN(groupId)) {
						continue;
					}

					await this.update({Id, group: groupId});
					break;
			}
		}
	}
}