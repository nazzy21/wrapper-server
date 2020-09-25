import Screen from "./screen";
import * as _ from "../utils";
import {gql} from "@wrapper/gql-server";
import {randomSalt, generateHashKey} from "../hash";
import multer from "multer";
import path from "path";
import {mkDir} from "../filesystem";
import {formatDate} from "../date";
import {decryptHashKey} from "../hash";

export default class GraphScreen extends Screen {
    constructor(ServerData) {
        super({}, ServerData);

        this.typeDefs = [];
        this.directives = [];

        this.prepareResponse = this.prepareResponse.bind(this);
        this.getDefinitions = this.getDefinitions.bind(this);
    }

    isUpload() {
        return !!this.getHeader("x-gql-upload");
    }

    setClient(client) {
        return async (req, res, next) => {
            this.client = client;

            await this.init(req, res);

            next();
        };
    }

    getDefinitions() {
        this.typeDefs = [];
        this.directives = [];

        for(const {typeDefs, resolvers, directives} of this.serverData.Definitions) {
            this.typeDefs.push({typeDefs, resolvers});

            if (directives) {
                this.directives = this.directives.concat(directives);
            }
        }

        this.gql = gql(this.typeDefs, this.directives, {screen: this});
    }

    async prepareResponse(req, res, next) {
        this.getDefinitions();

        await this.init(req, res);

        next();
    }

    async render(req, res) {
        return this.gql(req, res);
    }

    currentUserCan(permission) {
        if (!this.isUserLoggedIn()) {
            return false;
        }

        const user = this.currentUser;

        if (1 === user.group) {
            return true;
        }

        const caps = user.caps,
            perms = _.isArray(permission) ? permission : [permission];

        if (!caps || !caps.length) {
            return false;
        }

        for(const perm of perms) {
            if (!_.contains(caps, perm)) {
                return false;
            }
        }

        return true;
    }

    getStorage(fieldName) {
        return Uploader(fieldName, this.serverData.uploadPath);
    }
}