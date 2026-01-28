import { join } from 'path';
import { DataSource } from 'typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
dotenv.config();

const ormDBconfig: PostgresConnectionOptions | any = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'false' || process.env.DB_SSL === '0'
    ? false
    : {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      },
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: true,
  logging: true,
};
  
const dbDataSource = new DataSource({
  ...ormDBconfig,
  entities: [join(__dirname, '../modules/**/entities/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'migrations',
  cli: {
    migrationsDir: 'src/database/migrations',
  },
}); 

export default dbDataSource;
