const typeDefs = `
directive @user(user: String!) on FIELD | FIELD_DEFINITION
directive @permission(permission: String!) on FIELD | FIELD_DEFINITION

type User {
    userId: Int
    login: String
    email: String
    group: Int
    status: String
    createdAt: DateTime
    updatedAt: DateTime
}

type CurrentUser {
    Id: Int
    login: String
    email: String
    group: Int
    status: String
    createdAt: DateTime
    updatedAt: DateTime
    sessionId: String
}

type UserResults {
	foundUsers: Int
	statuses: Object
    userCount: Int
    statusCount: Object
    users: [User]
}

input UserInput {
    Id: Int
    login: String
    email: String
    group: Int
    status: String
    pass: String
}

type UserGroup {
	Id: Int
	name: String
	slug: String
	description: String
	caps: Array
	userCount: Int
	userStatusCount: Object
}

extend type Query {
	getCurrentUser: CurrentUser
	getUser(Id: Int!): User
	getUserBy(column: String! value: String!): User
	getUsers(
		search: String
		group: Int
		groupIn: [Int]
		status: String
		statusIn: [String]
		page: Int
		perPage: Int
		sortBy: String
		sort: String
	): [User]
	userQuery(
		search: String
		group: Int
		groupIn: [Int]
		status: String
		statusIn: [String]
		page: Int
		perPage: Int
		sortBy: String
		sort: String
	): UserResults
	userStatusCount: Object
	logout(client: String platform: Object): String @user(user: "login")
}

extend type Mutation {
	createUser(input: UserInput isSilent: Boolean): User @user(user: "login") @permission(permission: "manage-users")
	updateUser(input: UserInput isSilent: Boolean): User @user(user: "login") @permission(permission: "manage-users")
	deleteUser(Id: Int! isSilent: Boolean): Boolean @user(user: "login") @permission(permission: "delete-user")
	login(usr: String! pwd: String! client: String platform: Object): CurrentUser  @user(user: "guest")
	forgotPassword(email: String!): Boolean @user(user: "guest")
}
`;

export default typeDefs;