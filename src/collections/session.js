import Collection from "../collection";
import {randomSalt, isHashKey, generateHashKey, decryptHashKey} from "../hash";
import * as _ from "../utils";
import {i18n} from "../lang";
import {formatDate} from "../date";

/**
 Session Class
 Use to handle user's sessions, both guests and registered users.
**/
export default class AppSession extends Collection {
	constructor() {
		super("AppSession", {
			Id: {
				type: "String",
				length: 200,
				primary: true,
				index: true
			},
			createdAt: {
				type: "DateTime",
				defaultValue: "DateTime"
			},
			expires: {
				type: "Int"
			},
			client: {
				type: "String",
				required: true
			},
			platform: {
				type: "Object",
				required: true
			},
			login: {
				type: "Int",
				length: 1
			},
			userId: {
				type: "ForeignId",
				index: true
			}
		}, `
		extend type Config { sessionId: String }`);
	}

	/**
	 Get session data from the database.

	 @param {string} Id
	 	The Id of the session previously created or an encrypted key generated from session Id.
	 @returns {Promise<[Error, Object]>}
	**/
	async get(Id) {
		if (isHashKey(Id)) {
			const [err, key] = await decryptHashKey(Id);

			if (err) {
				return [err];
			}

			Id = key;
		}

		const [err, session] = await this.model().findOne(false, {Id});

		// Check expiration date
		if (session && this.isExpired(session)) {
			return [err, null];
		}

		return [err, session];
	}

	/**
	 Check if the session already met it's expiration date.

	 @param {object} session
	 @returns {Boolean}
	**/
	isExpired(session) {
		if (!session.expires) {
			return false;
		}

		const timeNow = formatDate().timestamp;

		return timeNow >= session.expires;
	}

	/**
	 Creates new session data in the database which expires after 30 days.

	 @param {object} session
	 	{
			@property {string} Id
				A unique session identifier.
			@property {string} client
			@property {object} platform
			@property {int} userId
	 	}
	 @returns {Promise<[Error, Object]>}
	**/
	async create(session = {}) {
		if (!session || !_.isObject(session)) {
			return [_.setError(i18n("Invalid session data!"), "invalid_session")];
		}

		if (!session.client || !session.platform) {
			return [_.setError(i18n("Invalid session arguments!"), "invalid_arguments")];
		}

		const date = formatDate().date;

		// Add expiration
		if (!session.userId) {
			session.expires = date.add(24, "hour").unix();
		} else {
			session.expires = date.add(30, "day").unix();
		}

		const [err] = await this.model().insert(session);

		if (err) {
			return [err];
		}

		return [null, session];
	}


	async update(session) {
		if (!session.Id) {
			return [_.setError(i18n("Cannot update none existent session!"), "invalid_id")];
		}

		if (isHashKey(session.Id)) {
			const [err, key] = await decryptHashKey(session.Id);

			if (err) {
				return [err];
			}

			session.Id = key; 
		}

		const [err2] = await this.model().update(session, {where: {Id: session.Id}});

		return [err2, session];
	}

	/**
	 Remove session data from the database.

	 @param {string} Id
	 	The Id of the session to delete to or an encrypted hash key generated from the session Id.
	 @returns {Promise<[Error, Boolean]>}
	**/
	async delete(Id) {
		if (isHashKey(Id)) {
			const [err, key] = await decryptHashKey(Id);

			if (err) {
				return [err];
			}

			Id = key;
		}

		return this.model().delete({Id});
	}

	/**
	 @private
	**/
	getResolvers() {
		return {
			Config: {
				sessionId: this.__getSessionId.bind(this)
			},
			CurrentUser: {
				sessionId: (user, __, {screen}) => 
					screen.session && screen.session.sessionId
			}
		};
	}

	/**
	 @private
	**/
	onLoad(server) {
		// Delete expired sessions every 24 hours
		server.cronJob({
			id: "guest-session",
			interval: _.DayInSeconds,
			callback: this.__maybeCleanUp.bind(this)
		});

		// Check sessionId existence then validate
		this.serverData.on("getSessionId", this.__getSession.bind(this));

		const User = server.getCollection("User");

		// Listen to user's login attempt
		User.on("preUserLogin", this.__canUserLogIn.bind(this));

		// Listen to user login action
		User.on("login", this.__createLoginSession.bind(this));

		// Listen to user logout action
		User.on("logout", this.__logoutSession.bind(this));
	}

	/**
	 @private
	 @callback
	**/
	async __maybeCleanUp() {
		const [err, list] = await this.model().find();

		if (err || !list || !list.length) {
			// Maybe log error??
			return;
		}

		const timeNow = formDate().timestamp,
			ids = [];

		for(const session of list) {
			if (this.isExpired(session)) {
				ids.push(session.Id);
			}
		}

		if (!ids.length) {
			return;
		}

		// just delete in silence
		this.model().delete({where: {Id: {$in: ids}}});
	}

	async __getSession(sessionId, screen) {
		if (!sessionId) {
			return null;
		}

		// If the session was previously fetch, bail!
		if (screen.session && screen.session.sessionId === sessionId) {
			return sessionId;
		}

		// Otherwise fetch the session data in the database
		const [err, session] = await this.get(sessionId);

		if (err || !session) {
			return null;
		}

		session.sessionId = sessionId;
		screen.session = session;

		return sessionId;
	}

	/**
	 @private
	 @callback
	**/
	async __getSessionId({client, platform}, __, {screen}) {
		let sessionId = await screen.getSessionId(),
			create = true;

		if (screen.session && sessionId === screen.session.sessionId) {
			return sessionId;
		}

		const Id = screen.createSessionKey(),
			session = {Id, client, platform};

		const [err] = await this.create(session);
	
		if (err) {
			return null;
		}

		sessionId = await screen.createSessionId(Id);

		return sessionId;
	}


	/**
	 @private
	 @callback
	**/
	async __canUserLogIn(canLogin, __, screen) {
		let session = screen.session,
			login = session.login||0;

		login += 1;

		// Login attempt limit?
		const limit = this.serverData.loginAttempt;

		// If ther's no limit set, return
		if (!limit) {
			return canLogin;
		}

		if (login > parseInt(limit)) {
			return _.setError(i18n("You have exceeded the number of times to verify your account. Please try again after 24 hours."), "limit_exceeded");
		}

		session.login = login;

		// Update expiration so it would set 24 hours from the last login
		const date = formatDate().date;

		session.expires = date.add(24, "hour").unix();

		const [err] = await this.update(session);

		if (err) {
			return err;
		}

		return canLogin;
	}

	/**
	 @private
	 @callback
	**/
	async __createLoginSession(user, {client, platform}, screen) {
		const sessionId = await screen.getSessionId(),
			Id = screen.createSessionKey(),
			session = {Id, client, platform, userId: user.Id};

		// Delete current session
		await this.delete(sessionId);

		const [err, newSession] = await this.create(session);

		if (err) {
			return;
		}

		newSession.sessionId  = await screen.createSessionId(Id);
		screen.session = newSession;
	}

	/**
	 @private
	 @callback
	**/
	async __logoutSession(sessionId, user, {client, platform}, screen) {
		
		// Delete current session
		await this.delete(sessionId);

		const Id = screen.createSessionKey(),
			session = {Id, client, platform};

		const [err, newSession] = await this.create(session);

		if (err) {
			return err;
		}

		return screen.createSessionId(Id);
	}
}