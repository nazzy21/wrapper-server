import * as _ from "../utils";
import {randomSalt, generateHashKey, decryptHashKey} from "../hash";

export default class Screen {
    constructor({client}, serverData) {
        this.serverData = serverData;
        this.client = client;

        this.init = this.init.bind(this);
        this.render = this.render.bind(this);
    }

    isAdmin() {
        return 'admin' === this.client;
    }

    isClient() {
        return 'client' === this.client;
    }

    isMobile() {
        return 'mobile' === this.client;
    }

    getClient() {
        return this.client;
    }

    getCollection(name) {
        return this.serverData.getCollection(name);
    }

    getHeader(name) {
        return this.req && this.req.header && this.req.header(name);
    }

    setHeader(name, value) {
        return this.req && this.res.set(name, value);
    }

    setCookie(cookie) {
        if (!this.res) {
            return;
        }

        let {name, value, expires, cookiePath, cookieDomain, ssl, httpOnly, sameSite} = cookie;

        let args = _.extend({
            expires,
            maxAge: expires,
            path: cookiePath || '/',
            domain: cookieDomain || this.req.hostname,
            ssl: ssl,
            httpOnly: httpOnly,
            sameSite: sameSite
        }, cookie);

        this.res.cookie( name, value, args );
    }

    getCookie(name) {
        return this.req.cookies && this.req.cookies[name];
    }

    createSessionKey() {
        return randomSalt(64, 32, "hex");
    }

    async createSessionId(sessionKey) {
        const [err, hashKey] = await generateHashKey(sessionKey);

        this.setHeader( 'X-Session-Id', hashKey );
        this.setCookie({
            name: '__sid__',
            value: hashKey,
            expires: Date.now() + (_.DayInMicroSeconds * 30)
        });

        return hashKey;
    }

    async getSessionId() {
        let req = this.req,
            sessionId;

        if (req.header) {
            sessionId = req.header('x-session-id');
        } else if (req.headers && req.headers['x-session-id']) {
            sessionId = req.headers['x-session-id'];
        }

        if (!sessionId) {
            // Look in cookies
            sessionId = this.getCookie('__sid__');
        }

        if (sessionId) {
            /**
             Filter sessionId to validate it's existence and set current user.

             @param {string} sessionId
             @param {object} screen
            **/
           sessionId = await this.serverData.filter("getSessionId", sessionId, this);
        }

        return sessionId;
    }

    isUserLoggedIn() {
        return this.currentUser.Id > 0;
    }

    async init(req, res) {
        this.req = req;
        this.res = res;

        this.Ip = req.ip;
        this.session = false;
        this.currentUser = {userId: 0};
        this.url = req.url;
    }

    async createClientId() {
        const secretKey = await this.serverData.getSecretKey(),
            [, clientId] = await generateHashKey(secretKey);

        return clientId;
    }

    async isValidClientId(token) {
        const secretKey = await this.serverData.getSecretKey(),
            [err, authKey] = await decryptHashKey(token);

        return secretKey === authKey;
    }

    async render(req, res, next) {
        await this.init(req, res);

        const {name, tagline, host, protocol, lastUpdated, adminEndPoint,
            mobileEndPoint, lang, routeEndPoint, server} = this.serverData,
            config = {name, tagline, host, lang, protocol, lastUpdated, adminEndPoint};

        if ("web" === server) {
            config.routeEndPoint = routeEndPoint;
        } else if ("admin" === server) {
            config.routeEndPoint = adminEndPoint + routeEndPoint;
        }

        config.clientId = await this.createClientId();

        // Include client && server type
        config.client = this.client;
        config.server = server;

        const html = await this.serverData.html(config);

        res.send(html);
    }
}