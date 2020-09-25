import dotenv from "dotenv";
import path from "path";
import Hook from "./hooks";
import * as _ from "./utils";
import {serve, serveAdmin, serveClient, serveMobile} from "./app";
import {formatDate} from "./date";
import * as MySQL from "@wrapper/mysql";
import {mailConfig} from "./mail";
import html from "./html";
import {readFile, readDir} from "./filesystem";
import AppSettings from "./collections/settings";
import AppSession from "./collections/session";
import UserGroup from "./collections/user-group";
import User from "./collections/user";
import UserMeta from "./collections/user-meta";

const [,,mode] = process.argv;

export default class Server extends Hook {
	constructor({name, basePath = process.cwd(), version = "1.0.0"}) {
		super();

        this.define({name, basePath, mode: mode||"production", version, __collections: []});

        this.staticRoutes = [];
        this.Collection = {};
        this.Definitions = [];

        // Bind methods for convenvience
        this.define = this.define.bind(this);
        this.createCollections = this.createCollections.bind(this);
        this.validateConfig = this.validateConfig.bind(this);

        // Cron jobs
        this.cronJobs = {};
	}

    reset() {
        this.hooks = {};
        this.Collection = {};
        this.Definitions = [];
        this.staticRoutes = [];
    }

    /**
     Set or update a server cron job

     @param {object} cron
        {
            @property {string} id
            @property {int} interval
                The number of second the task gets executed.
            @property {function} callback
            @property {array} args
        }
    **/
    cronJob(cron) {
        if (!cron.id) {
            return; // Require an id for unique reference
        }

        // Add start time
        cron.lastCheck = formatDate().timestamp;

        this.cronJobs[cron.id] = cron;
    }

    /**
     Removes a cron job.

     @param {string} id
    **/
    removeCronJob(id) {
        if (this.cronJobs[id]) {
            delete this.cronJobs[id];
        }
    }

    close() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    /**
     Load primary collections
    **/
    onLoad() {
        this.addCollection(AppSettings, AppSession);
        this.addCollection(User, UserGroup, UserMeta);
    }

    /**
     Check if the application is run in production mode.
    **/
    isProduction() {
        return "production" === this.mode;
    }

    /**
     Adds constant object variables.

     @param {string|object} name
        The name of the variable to add to. If an object, it iterates the object properties and add each
        to the server object.
     @param {*} value
     @returns {void}
    **/
	define(name, value = null) {
        _.define(this, name, value);
    }

    /**
     Sets static route readable by public.

     @param {string} pathName
     @param {string} absPath
        The absolute path location where the content or files reside.
    **/
    setStaticRoute(pathName, absPath) {
        this.staticRoutes.push({pathName, absPath});
    }

    /**
     Creates collections to the database.
    **/
    async createCollections() {
        for(const name of this.__collections) {
            const model = this.Collection[name],
                [err] = await model.createCollection();

            if (err) {
                throw err;
            }

            if (!model.onLoad) {
                continue;
            }

            await model.onLoad.call(null, this);
        }
    }

    /**
     Adds a collection object or a set of collection object to the list.

     @param {object} collection
        An object which handles database and client transaction.
     @returns {void}
    **/
    addCollection(...collections) {
        for(const Collection of collections) {
            try {
                const colObj = new Collection();

                // Add to collection list
                this.Collection[colObj.name] = colObj;

                // Bind object data for quick access
                _.define(colObj, 'serverData', this);

                // Add to the list
                this.__collections.push(colObj.name);
            } catch(e) {
                throw e;
            }
        }
    }

    /**
     Returns an instance of collection object.

     @param {string} name
     @returns {object}
    **/
    getCollection(name) {
        return this.Collection[name];
    }

    /**
     Sets client request handlers.

     @param {string} typeDefs
        An graphql string which defines the object types.
     @param {object} resolvers
        An object which resolves the client's request.
     @param {object} directives
        An object which resolves the directive if there's any.
    **/
    gql(typeDefs, resolvers = {}, directives) {
        this.Definitions.push({typeDefs, resolvers, directives});
    }

    /**
     Returns an object containing the list of available database driver modules.

     @private
    **/
    __getDatabaseDrivers() {
        return {mysql: MySQL};
    }

    /**
     @private
    **/
    __getConfig(prefix, configData) {
        const config = {},
            pattern = new RegExp(`^${prefix}`);

        for(const key of Object.keys(configData)) {
            if (!key.match(pattern)) {
                continue;
            }

            const name = key.replace(prefix, "").toLowerCase();

            config[name] = configData[key];
        }

        return config;
    }

    __setInterval() {
        if (this.timer) {
            // In case a previous timer is acting up
            clearInterval(this.timer);
        }
        
        this.timer = setInterval(this.__executeCronJobs.bind(this), 60000 * 5);
    }

    /**
     @private
     @callback
    **/
    async __executeCronJobs() {
        // Stop the timer while executing
        clearInterval(this.timer);

        const timeNow = formatDate().timestamp;

        for(const id of _.keys(this.cronJobs)) {
            const {lastCheck, interval, callback, args} = this.cronJobs[id],
                _interval = lastCheck + (1000 * interval);

            if (_interval > timeNow) {
                continue;
            }

            // Make sure to update the time check
            this.cronJobs[id].lastCheck = timeNow;

            await callback.apply(null, args);
        }

        // Restart timer
        this.__setInterval();
    }

    /**
     Validates the application's configuration.
    **/
    async validateConfig() {
        const config = this.getConfig();

        // Validate configuration file
        _.devAssert(!_.isEmpty(config.name), "Missing application name!");
        _.devAssert(!_.isEmpty(config.tagline), "Write at most 60 chars tagline!");

        // Get config data
        const data = _.pick(config, ["name", "tagline", "routeEndPoint", "secretKey", "adminEmail", "loginAttempt"]);

        this.define(data);

        // Set app's default language
        this.lang = config.lang||"en";

        // Validate database
        const database = this.__getConfig("DB_", config),
            drivers = this.__getDatabaseDrivers(),
            driver = drivers[config.database.toLowerCase()];

        _.devAssert(driver, "Invalid database driver!");

        // Validate database configuration
        const [err] = await driver.assert(database);

        if (err) {
            throw err;
        }

        this.define({driver, database});

        // Check for mail configuration
        const mailer = this.__getConfig("Mailer_", config);

        if (!_.isEmpty(mailer)) {
            const defaults = {adminEmail: config.adminEmail};

            mailConfig(mailer, defaults);
        }

        /**
         Trigger to call additional validation if there's any.
         Any validation that fails must throw an error in order for the validation to fail.
         Otherwise it will assume a success if there's no thrown error.

         @param {object} config
         @param {object<Server>} server
        **/
        await this.trigger("serverValidate", config, this);

        return config;
    }

    /**
     Returns an object containing the application's configuration.

     @returns {object}
    **/
    getConfig() {
        const config = dotenv.config({path: path.resolve(this.basePath, "./.env")});

        return config.parsed;
    }

    /**
     Returns the application's unique secret key generated when creating
     the .env file.

     @returns {string}
    **/
    getSecretKey() {
        return this.secretKey;
    }

    /**
     Must be overriden in a child class.
    **/
    getTheme() {
        return {};
    }

    /**
     Returns the application's templates.

     @param {string} client
     @returns {Promise<Object>>}
    **/
    async __getTemplates(client, themePath) {
        const templates = {},
            theme = this.theme;

        if (!themePath) {
            if (!theme || !theme.path) {
                return templates;
            }

            themePath = theme.path;
        }

        const templatePath = path.resolve(themePath, `./templates/${client}`),
            [, files] = await readDir(templatePath);

        for(const file of files) {
            if (!file.match(".html")) {
                continue;
            }

            const [, fileData] = await readFile(file);

            let filename = file.replace(templatePath, "");
            filename = filename.replace(/\\/g, "/").replace(".html", "");

            templates[filename] = fileData.replace(/<\!--.*?-->|\r?\n|\r|\t/sg, " ");
        }

        return templates;
    }

    async getTemplates(client) {
        if (!this.theme || !this.theme.templates || !this.theme.templates[client]) {
            return {};
        }

        return this.theme.templates[client];
    }

    /**
     Returns the html structure to display the screen. Use in web/client type.
    **/
    async html(config) {
        this.theme = await this.getTheme();

        return html(config, this);
    }

    /**
     @param {object} config
        Defines how the requests are handled.
        {
            @property {int} port
            @property {string} host
            @property {Object} ssl
            @property {string} adminEndPoint
            @property {string} mobileEndPoint
        }
    **/
    async serve(config) {
        await this.validateConfig();

        return serve(config, this);
    }

    async serveAdmin(port, host, ssl = false) {
        await this.validateConfig();

        return serveAdmin(port, host, ssl, this);
    }

    async serveClient(port, host, ssl = false) {
        await this.validateConfig();

        return serveClient(port, host, ssl, this);
    }

    async serveMobile(port, host, ssl = false) {
        await this.validateConfig();

        return serveMobile(port, host, ssl, this);
    }
}

export function getServer(name, ServerModel) {
    if (!Object[name]) {
        Object.defineProperty(Object, name, {value: new ServerModel()});
    }

    return Object[name];
}