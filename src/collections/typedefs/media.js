const typeDefs = `
type Media {
	Id: Int
	name: String
	file: Object
	sizes: Object
	createdAt: DateTime
	uploadedBy: String
	type: String
}

input InputMedia {
	Id: Int
	name: String
	file: Object
	sizes: Object
	type: String
}

type MediaQuery {
	foundItems: Int
	typeCount: Object
	media: [Media]
}

extend type Query {
	getFile(fileId: Int filePath: String): Media
	deleteFile(fileId: Int filePath: String): Boolean @user(user: "login") @permission(permission: "delete-media")
	mediaQuery(type: String page: Int perPage: Int): MediaQuery
}

extend type Mutation {
	uploadFile(name: String save: Boolean crop: Object): Object
	uploadFiles(name: String save: Boolean crop: Object): [Object]
	updateFile(input: InputMedia): Media
}
`;

export default typeDefs;