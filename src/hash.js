import * as _ from "./utils";
import {i18n} from "./lang";
import crypto from "crypto";

const encoding = 'aes-256-cbc',
    typeType = 'base64';

export function randomSalt(bytes = 16, length = 64, format = 'base64') {
    bytes = bytes || 16;
    length = length || 64;
    format = format || 'base64';

    return crypto.randomBytes(bytes)
        .toString(format)
        .slice( 0, length );
}

export function generateHashKey(uniqKey) {
    uniqKey = uniqKey || randomSalt();

    const SECRET_KEY = randomSalt(64, 32, 'hex').toString();

    return new Promise(res => {
        let iv = crypto.randomBytes(16),
            secretKey = Buffer.from(SECRET_KEY),
            cipher = crypto.createCipheriv( encoding, secretKey, iv );

        cipher.on('readable', () => {
            let key = cipher.read();

            if ( ! key ) {
                return res([_.setError(
                    i18n('Something went wrong. Unable to generate hash key.'),
                    'system_error')
                ]);
            }

            key = [iv.toString(typeType), key.toString(typeType), SECRET_KEY];

            res([null, key.join(';)')]);
        });

        cipher.write(uniqKey);
        cipher.end();
    });
}

export function isHashKey(hash) {
    return hash && 3 === hash.split(";)").length;
}

export function decryptHashKey(hash) {
    return new Promise( res => {
        if (!isHashKey(hash)) {
            return res([_.setError('Invalid arguments!')]);
        }

        let _hash = hash.split(';)'),
            secretKey = Buffer.from( _hash[2] ),
            iv, encrypt;

        iv = Buffer.from(_hash[0], typeType);
        encrypt = Buffer.from(_hash[1], typeType);

        let decipher = crypto.createDecipheriv( encoding, secretKey, iv );

        decipher.on('readable', () => {
            let match = decipher.read();

            if(!match) {
                return res([_.setError(
                    i18n('Something went wrong. Unable to decrypt the given hash!'),
                    'system_error')
                ]);
            }

            match = match.toString();

            res([null, match]);
        });
        decipher.write(encrypt);
        decipher.end();
    });
}