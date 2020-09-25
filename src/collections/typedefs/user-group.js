const typeDefs = `
extend type User {
	caps: Array
	groupId: Int
	groupName: String
	groupSlug: String
}

extend type CurrentUser {
	caps: Array
	groupId: Int
	groupName: String
	groupSlug: String
}

input UserGroupInput {
	Id: Int
	name: String
	description: String
	slug: String
	caps: Array
}

extend type Query {
	getUserGroup(Id: Int slug: String): UserGroup
	getUserGroups: [UserGroup]
}

extend type Mutation {
	createUserGroup(input: UserGroupInput): UserGroup @user(user: "login") @permission(permission: "manage-users")
	updateUserGroup(input: UserGroupInput): UserGroup @user(user: "login") @permission(permission: "manage-users")
	deleteUserGroup(Id: Int! action: String value: Object): Boolean @user(user: "login") @permission(permission: "delete-user")
}
`;

export default typeDefs;