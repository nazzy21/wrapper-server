const typeDefs = `
scalar Any

type UserMeta {
	Id: Int
	userId: Int
	name: String
	value: Any
}

input InputMeta {
	Id: Int
	userId: Int
	name: String
	value: Any
}

extend type User {
	meta: [UserMeta]
}

extend type CurrentUser {
	meta: [UserMeta]
}

extend type Query {
	getUserMeta(userId: Int!): [UserMeta]
}

extend type Mutation {
	setUserMeta(input: InputMeta): UserMeta @user(user: "login")
	setUserMetaData(userId: Int! input: [InputMeta] deletable: [Int]): [UserMeta] @user(user: "login")
	deleteUserMEta(name: String userId: Int): Boolean @user(user: "login")
}
`;
export default typeDefs;