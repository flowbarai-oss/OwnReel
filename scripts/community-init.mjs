import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
try {
 await writeFile('.env',`COMMUNITY_DB_PASSWORD=${randomBytes(24).toString('hex')}\nCOMMUNITY_ORIGIN=http://localhost:4420\n`,{flag:'wx',mode:0o600});
 console.log('Created private .env. Run docker compose --env-file .env -f deploy/community/compose.yaml up --build -d');
} catch(error) {
 if(error.code==='EEXIST')console.log('.env already exists and was not changed.');else throw error;
}
