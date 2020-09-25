import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

// Extend utc
dayjs.extend(utc);

/**
 Formats datetime.

 @param {string|object} dateString
 	The date string or date object to format to. If null, will use the current locale datetime.
 @param {string} format
 	The date format structure.

 @returns {object}
 	{
		@property {string} local
			User's locale datetime.
		@property {string} utc
			UTC timezone datetime.
		@property {string} db
			Database formatted datetime.
		@property {int} timestamp
			The date's timestamp conversion.
 	}
**/
export function formatDate(dateString, format = null) {
	const date = dayjs(dateString),
		dbFormat = "YYYY-MM-DD HH:mm:ss";

	if (!date.isValid()) {
		return null;
	}

	return {
		date,
		local: date.local().format(format),
		utc: date.utc().format(format),
		db: date.utc().format(dbFormat),
		timestamp: date.unix()
	};
}