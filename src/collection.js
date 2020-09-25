import * as _ from "./utils";
import Hook from "./hooks";
import {i18n} from "./lang";

export default class Collection extends Hook {
    /**
     Constructor

     @param {string} name
        The collection name. Also use as the table name in the database.
     @param {object} schema
        An object which defines the collection's column structure.
     @param {string} typeDefs
        An AST graphql definitions used alongside with the collection.
    **/
    constructor(name, schema, typeDefs = false) {
        super();

        this.name = name;
        this.schema = schema;
        this.typeDefs = typeDefs;

        this.response = this.response.bind(this);
        this.onLoad = this.onLoad.bind(this);
    }

    model() {
        if (!this.dbModel) {
            const {driver, database} = this.serverData,
                DBCollection = driver.Collection;

            this.dbModel = new DBCollection(this.name, this.schema, database);
        }

        return this.dbModel;
    }

    /**
     Returns an AST graphql definition.
    **/
    getTypeDefs() {
        return this.typeDefs;
    }

    /**
     Creates collection table in the database.

     @param {object} options
        An additional collection options to set when creating the collection table.
    **/
    createCollection(options = false) {
        return this.model().create(options);
    }

    /**
     Removes collection model and it's content in the database.
    **/
    dropCollection() {
        return this.model().drop();
    }

    serverError() {
        return _.setError(i18n("We are unable to process your request at this time. Try again later."), "server_error");
    }

    /**
     Helper function to safely set the response for a gql request.
    **/
    response([err, res]) {
        return err||res;
    }

    /**
     Must be overridden in a sub-class.
    **/
    onLoad() {}
}