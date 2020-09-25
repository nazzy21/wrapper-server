const typeDefs = `
directive @sessionId on FIELD | OBJECT
directive @clientId(clientId: String client: String platform: Object) on FIELD | FIELD_DEFINITION

scalar Object
scalar Array
scalar DateTime

type Config {
	templates: Object
	settings: Object
}

type Setting {
	name: String
	value: Object
	autoload: Boolean
}

input SettingInput {
	name: String
	value: Object
	autoload: Boolean
}

type Query @sessionId {
	getConfig(clientId: String client: String! platform: Object): Config @clientId(clientId: "$.clientId" client: "$.client" platform: "$.platform")
	getSetting(name: String autoload: Boolean): [Setting]
}

type Mutation @sessionId {
	setSetting(input: SettingInput): Boolean
	deleteSetting(name: String!): Boolean
}
`;

export default typeDefs;