import nodeMailer from "nodemailer";
import * as _ from "./utils";

/**
 Sends email base on the set mailData options.

 @param {string} to
 	An email address or list of email addresses separated by comma to send the message to.
 @param {string} subject
 	The mail subject.
 @param {string} message
 	The message to send to.
 @param {object} options
 	Additional mail configuration/options to use on mail transport.
 	{
		@property {string} from
		@property {string} cc
		@property {string} bcc
		@property {array<object>} attachments
			{
				@property {string} filename
				@property {string} path
					The absolute path of the file to include.
				@property {string} cid
					A unique identification use in inline images source.
			}
		@property {object} tokens
			An object list which transform a token string into an actual content data.
 	}
 **/
export default function sendMail(to, subject, message, options = {}) {
	const transport = new Mailer(),
		{cc, bcc, attachments} = options,
		mail = {to, subject, cc, bcc, attachments};

	mail.from = transport.getMailFrom(options.fromName, options.from);

	const type = options.type||"html";
	
	// Generate message if there are tokens
	mail[type] = transport.createMessage(message, options.tokens);

	return transport.send(mail).catch(_.setError);
}

export function mailConfig(config, defaults = {}) {
	const {port, host, user, pass} = config,
		mailConfig = {port, host},
		auth = {user, pass};

	if (config.authType) {
		auth.type = config.authType;
	}

	mailConfig.auth = auth;

	Mailer.prototype.config = mailConfig;
	Mailer.prototype.defaults = defaults;
}

export function getMailFrom(fromName = "", fromEmail = "") {
	const mailer = new Mailer();

	return mailer.getMailFrom(fromName, fromEmail);
}

function Mailer() {
	this.transport = nodeMailer.createTransport(this.config);

	return this;
}

Mailer.prototype.send = function(mail) {
	return this.transport.sendMail(mail);
}

Mailer.prototype.getMailFrom = function(fromName = "", fromEmail = "") {
	const name = fromName||"Admin",
		email = fromEmail||this.defaults.adminEmail;

	return `${name} <${email}>`;
}

Mailer.prototype.createMessage = function(message, tokens = {}) {
	if (!tokens || _.isEmpty(tokens)) {
		return message;
	}

	let _message = message;

	for(const token of Object.keys(tokens)) {
		const pattern = new RegExp(`{${token.toUpperCase()}}`, "gi");
		_message = _message.replace(pattern, tokens[token]);
	}

	return _message;
}