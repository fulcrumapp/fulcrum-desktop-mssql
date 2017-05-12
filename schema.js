import Schema from 'fulcrum-schema/dist/schema';
import sqldiff from 'sqldiff';
import MSSQLSchema from './mssql-schema';

const {SchemaDiffer, Postgres} = sqldiff;

export default class PostgresSchema {
  static async generateSchemaStatements(account, oldForm, newForm) {
    let oldSchema = null;
    let newSchema = null;

    if (oldForm) {
      oldSchema = new Schema(oldForm, MSSQLSchema, null);
    }

    if (newForm) {
      newSchema = new Schema(newForm, MSSQLSchema, null);
    }

    const differ = new SchemaDiffer(oldSchema, newSchema);
    const generator = new Postgres(differ, {afterTransform: null});

    generator.tablePrefix = 'account_' + account.rowID + '_';

    const statements = generator.generate();

    return {statements, oldSchema, newSchema};
  }
}
