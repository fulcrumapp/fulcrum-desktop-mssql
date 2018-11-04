import Schema from 'fulcrum-schema/dist/schema';
import sqldiff from 'sqldiff';
import MSSchema from './mssql-schema';

const {SchemaDiffer, MSSQL} = sqldiff;

export default class MSSQLSchema {
  static async generateSchemaStatements(account, oldForm, newForm, disableArrays, disableComplexTypes, userModule, tableSchema) {
    let oldSchema = null;
    let newSchema = null;

    MSSchema.disableArrays = disableArrays;
    MSSchema.disableComplexTypes = disableComplexTypes;

    if (userModule && userModule.updateSchema && !MSSchema._modified) {
      userModule.updateSchema(MSSchema);

      MSSchema._modified = true;
    }

    if (oldForm) {
      oldSchema = new Schema(oldForm, MSSchema, userModule && userModule.schemaOptions);
    }

    if (newForm) {
      newSchema = new Schema(newForm, MSSchema, userModule && userModule.schemaOptions);
    }

    const differ = new SchemaDiffer(oldSchema, newSchema);
    const generator = new MSSQL(differ, {afterTransform: null});

    generator.tablePrefix = 'account_' + account.rowID + '_';

    if (tableSchema) {
      generator.tableSchema = tableSchema;
    }

    const statements = generator.generate();

    return {statements, oldSchema, newSchema};
  }
}
