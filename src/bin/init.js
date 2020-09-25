#!/usr/bin/env node
import {randomSalt} from "../hash";
import * as _ from "../utils";
import {readFile, writeFile, mkDir} from "../filesystem";
import path from "path";
import dotenv from "dotenv";

const absPath = process.cwd();

export async function createFolders() {
	/**
	 Public folder is use to store override templates.
	**/
	const [err] = await mkDir(path.resolve(absPath, "./public"));

	if (err && "EEXIST" !== err.code) {
		throw err;
	}

	/**
	 Uploads folder is where the uploaded media files are stored.
	**/
	const [err2] = await mkDir(path.resolve(absPath, "./uploads"));

	if (err2 && "EEXIST" !== err2.code) {
		throw err2;
	}

	return true;
}

export async function createEnv(defaults = {}) {
	defaults = _.extend({
		name: "Application",
		tagline: "Something about the app.",
		DB_Prefix: "app_"
	}, defaults);

	// Generate secretKey
	defaults.secretKey = randomSalt(64);

	// Get existing configuration here
	const filename = path.resolve(absPath, `./.env`),
		config = dotenv.config({path: filename});

	if (config) {
		const data = config.parsed;

		defaults = _.extend(defaults, data);
	}

	return setAppEnv(defaults);
}

function setAppEnv(data) {
	const _env = `## === CONFIGURATION ===
## Application Name
##  Must be short, at least 20 characters
name = ${data.name||""}

## Tagline 
## A brief description describing your application in at most 40 characters.
tagline = ${data.tagline||""}

## Secret Key 
## A unique encrypted key use in the application.
secretKey = ${data.secretKey}

## Language
## The language use in the application.
## By default the application is using an 'en' (English) language
lang = ${data.lang||"en"}

## Login Attempt
## The number of times user is able to keep verifying their login credentials
loginAttempt = 5

## End Point 
## A unique url slug where various http requests are send and handled.
routeEndPoint = ${data.routeEndPoint||""}

## Admin email
## The email widely use within the system to transport an email notification.
adminEmail = ${data.adminEmail||""}

## Database
## By default, the application use MySQL database. If you want to change other database system, 
## change the database name along with it's corresponding configuration options below.
database = MySQL

DB_Database = ${data.DB_Database||""}
DB_User = ${data.DB_User||""}
DB_Password = ${data.DB_Password||""}

## You may changed the prefix used to create table models in your database.
## Note that when you changed the database prefix, you may need to reinstall the database models.
DB_Prefix = ${data.DB_Prefix||"__"}

## Mailer
## 'nodemailer' is the library use to transport any email within the application. 
## Be sure to configure the right format base on the options your mail provider set.
## For more details checkout https://nodemailer.com/
Mailer_Port = ${data.Mailer_Port||""}
Mailer_Host = ${data.Mailer_Host||""}

## By default, the mail transport is using a plain authentication method. For oauth/oauth2 authentication type
Mailer_User = ${data.Mailer_User||""}
Mailer_Pass = ${data.Mailer_Pass||""}
`;

	const filename = path.resolve(absPath, "./.env");

	return writeFile(filename, _env);
}