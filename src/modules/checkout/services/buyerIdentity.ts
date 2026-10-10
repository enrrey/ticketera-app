import {createCipheriv, createHmac, randomBytes} from 'node:crypto';

/** Identity number never enters payment metadata, logs or public order responses. */
export function encryptBuyerDocument(value:string) {
  const secret=process.env.QR_SIGNING_SECRET;
  if(!secret || !/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Private buyer data encryption unavailable');
  const key=createHmac('sha256',Buffer.from(secret,'hex')).update('buyer-document:v1').digest();
  const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',key,iv);
  const body=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),body.toString('base64url')].join('.');
}
