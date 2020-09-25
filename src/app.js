import http from "http";
import https from "https";
import express from "express";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import * as _ from "./utils";
import GraphScreen from "./screens/graphql";
import Screen from "./screens/screen";
import {html} from "./error";

const app = express(),
    [,,mode] = process.argv;

/**
 Serves all types of requests.

 @param {int} port
 @param {string} host
 @param {object} ssl
 @param {string} adminEndPoint
    The endpoint use to display admin screens on the web.
 @param {string} mobileEndPoint
    The endpoint to use to cater a mobile requests coming from a mobile app.
**/
export function serve(
    {
        port = 80,
        host = 'localhost',
        ssl = {},
        adminEndPoint = '/admin',
        mobileEndPoint = '/mobile'
    },
    ServerData
) {
    _.devAssert(!_.isEmpty(port), 'No port number specified!');
    _.devAssert(!_.isEmpty(host), 'No host name specified!');

    init(ServerData);
    admin(adminEndPoint || '/admin', ServerData);
    mobile(mobileEndPoint || '/mobile', ServerData);
    client(ServerData);

    // Mark listener type
    ServerData.server = 'web';

    return listen(port, host, ssl, ServerData);
}

/**
 Use to serve web client screens. Excluding any adminstrative screens there is.

 @param {int} port
 @param {string} host
 @param {object} ssl
 @param {object<Sever>} ServerData
    An instance of child-class of the class Server
**/
export function serveClient(port, host, ssl = {}, ServerData) {
    _.devAssert(!_.isEmpty(port), 'No port number specified!');
    _.devAssert(!_.isEmpty(host), 'No host name specified!');

    init(ServerData);
    client(ServerData);

    ServerData.server = 'client';

    return listen(port, host, ssl, ServerData);
}

/**
 Use to server adminstrative screens only.

 @param {string} port
 @param {string} host
 @param {object} ssl
 @param {object<Server>} ServerData
    An instance of a child-class of class Server.
**/
export function serveAdmin(port, host, ssl = {}, ServerData) {
    _.devAssert(!_.isEmpty(port), 'No port number specified!');
    _.devAssert(!_.isEmpty(host), 'No host name specified!');

    init(ServerData);
    admin(false, ServerData);

    ServerData.server = 'admin';

    return listen(port, host, ssl, ServerData);
}

/**
 Use to serve mobile requests only.

 @param {int} port
 @param {string} host
 @param {object} ssl
 @param {object<Server>} ServerData
    An instance of a child-class of class Server.
**/
export function serveMobile(port, host, ssl = {}, ServerData) {
    _.devAssert(ServerData.isConfigured(), 'No configuration found!');
    _.devAssert(!_.isEmpty(port), 'No port number specified!');
    _.devAssert(!_.isEmpty(host), 'No host name specified!');

    init(ServerData);
    mobile(false, ServerData);

    ServerData.client = 'mobile';

    return listen(port, host, ssl, ServerData);
}

function init(ServerData) {
    const staticOptions = {
        index: false,
        fallthrough: true,
        dotfiles: 'ignore',
        extensions: ['js', 'css', 'jpg', 'jpeg', 'png', 'gif', 'ico']
    };

    app.use(
        cookieParser(),
        bodyParser.json(),
        bodyParser.urlencoded({extended: true})
    );
}

async function listen(port, host, ssl = {}, ServerData) {
    port = port || process.env.PORT;

    ServerData.define({
        protocol: _.isEmpty(ssl) ? 'http' : 'https',
        port,
        host,
        app,
        mode
    });

    await setUp(ServerData);

    if (!_.isEmpty(ssl)) {
        return https.createServer(ssl, app).listen(port, host);
    }

    return http.createServer(app).listen(port, host);
}

function admin(endPoint = null, ServerData) {
    let adminApp = app;

    if (endPoint) {
        adminApp = express.Router();
        app.use(endPoint, adminApp);
        ServerData.adminEndPoint = endPoint;
    }

    ServerData.adminApp = adminApp;
}

function client(ServerData) {
    ServerData.clientApp = app;
}

function mobile(endPoint = null, ServerData) {
    let mobileApp = app;

    if (endPoint) {
        mobileApp = express.Router();
        app.use(endPoint, mobileApp);
    }
    ServerData.mobileApp = mobileApp;
}

function serveStatic(staticRoutes) {
    const staticOptions = {
        index: false,
        fallthrough: true,
        dotfiles: 'ignore',
        maxAge: '365d',
        // TODO: GET ALL STATIC FILE FORMAT
        extensions: ['js', 'css', 'jpg', 'jpeg', 'png', 'gif', 'ico']
    };

    for(const {pathName, absPath} of staticRoutes) {
        app.use(pathName, express.static(absPath, staticOptions));
    }
}

async function setUp(obj) {
    // Clear server object
    obj.reset();

    // Run interval listener
    obj.__setInterval();

    // Call setup initializers
    await obj.onLoad();
   
    // Set static paths
    serveStatic(obj.staticRoutes);

    // Reload collections
    await iterateCollections(obj);

    const gql = new GraphScreen(obj),
        endPoint = obj.routeEndPoint;

    // Generate gql definitions
    gql.getDefinitions();

    if (obj.adminApp) {
        obj.adminApp.get(endPoint, gql.setClient("admin"), gql.render);
        obj.adminApp.post(endPoint, gql.setClient("admin"), gql.render);

        const admin = new Screen({client: "admin"}, obj);
        obj.adminApp.get("*", admin.render);
    }

    if (obj.clientApp) {
        obj.clientApp.get(endPoint, gql.setClient("client"), gql.render);
        obj.clientApp.post(endPoint, gql.setClient("client"), gql.render);
        
        const client = new Screen({client: "client"}, obj);
        obj.clientApp.get("*", client.render);
    }

    if (obj.mobileApp) {
        obj.mobileApp.get(endPoint, gql.setClient("mobile"), gql.render);
        obj.mobileApp.post(endPoint, gql.setClient("mobile"), gql.render);
    }
}

async function iterateCollections(obj) {
    const funcs = [];

    for(const name of obj.__collections) {
        const model = obj.Collection[name],
            typeDefs = model.getTypeDefs && model.getTypeDefs();

        // Clear previous hooks
        //model.reset();

        if (typeDefs) {
            const resolvers = model.getResolvers && model.getResolvers(),
                directives = model.getDirectives && model.getDirectives();

            obj.gql(model.typeDefs, resolvers, directives);
        }

        if (!model.onLoad) {
            continue;
        }

        funcs.push(model.onLoad);
    }

    funcs.reduce( (promise, f) => promise.then(e => f.call(null, obj)), Promise.resolve());
}