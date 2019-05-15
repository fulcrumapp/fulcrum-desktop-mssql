import mssql from 'mssql';
import { format } from 'util';
import MSSQLSchema from './schema';
import { MSSQL } from 'fulcrum';
import MSSQLRecordValues from './mssql-record-values'
import snake from 'snake-case';
import templateDrop from './template.drop.sql';
import SchemaMap from './schema-map';
import * as api from 'fulcrum';
import { compact, difference, padStart } from 'lodash';

import version001 from './version-001.sql';
import version002 from './version-002.sql';
import version003 from './version-003.sql';
import version004 from './version-004.sql';
import version005 from './version-005.sql';
import version006 from './version-006.sql';

const MAX_IDENTIFIER_LENGTH = 100;

const MSSQL_CONFIG = {
  database: 'fulcrumapp',
  server: 'localhost',
  port: 1433,
  max: 10,
  idleTimeoutMillis: 30000
};

const MIGRATIONS = {
  '002': version002,
  '003': version003,
  '004': version004,
  '005': version005,
  '006': version006
};

const CURRENT_VERSION = 6;

const DEFAULT_SCHEMA = 'dbo';

const { log, warn, error, info } = fulcrum.logger.withContext('mssql');

export default class {
  async task(cli) {
    return cli.command({
      command: 'mssql',
      desc: 'run the mssql sync for a specific organization',
      builder: {
        mssqlConnectionString: {
          desc: 'mssql connection string (overrides all individual database connection parameters)',
          type: 'string'
        },
        mssqlDatabase: {
          desc: 'mssql database name',
          type: 'string',
          default: MSSQL_CONFIG.database
        },
        mssqlHost: {
          desc: 'mssql server host',
          type: 'string',
          default: MSSQL_CONFIG.host
        },
        mssqlPort: {
          desc: 'mssql server port',
          type: 'integer',
          default: MSSQL_CONFIG.port
        },
        mssqlUser: {
          desc: 'mssql user',
          type: 'string'
        },
        mssqlPassword: {
          desc: 'mssql password',
          type: 'string'
        },
        mssqlSchema: {
          desc: 'mssql schema',
          type: 'string'
        },
        mssqlSchemaViews: {
          desc: 'mssql schema for the friendly views',
          type: 'string'
        },
        mssqlSyncEvents: {
          desc: 'add sync event hooks',
          type: 'boolean',
          default: true
        },
        mssqlBeforeFunction: {
          desc: 'call this function before the sync',
          type: 'string'
        },
        mssqlAfterFunction: {
          desc: 'call this function after the sync',
          type: 'string'
        },
        org: {
          desc: 'organization name',
          required: true,
          type: 'string'
        },
        mssqlForm: {
          desc: 'the form ID to rebuild',
          type: 'string'
        },
        mssqlReportBaseUrl: {
          desc: 'report URL base',
          type: 'string'
        },
        mssqlMediaBaseUrl: {
          desc: 'media URL base',
          type: 'string'
        },
        mssqlUnderscoreNames: {
          desc: 'use underscore names (e.g. "Park Inspections" becomes "park_inspections")',
          required: false,
          type: 'boolean',
          default: true
        },
        mssqlPersistentTableNames: {
          desc: 'use the server id in the form table names',
          required: false,
          type: 'boolean',
          default: false
        },
        mssqlPrefix: {
          desc: 'use the organization ID as a prefix in the object names',
          required: false,
          type: 'boolean',
          default: true
        },
        mssqlRebuildViewsOnly: {
          desc: 'only rebuild the views',
          required: false,
          type: 'boolean',
          default: false
        },
        mssqlCustomModule: {
          desc: 'a custom module to load with sync extensions (experimental)',
          required: false,
          type: 'string'
        },
        mssqlSetup: {
          desc: 'setup the database',
          required: false,
          type: 'boolean'
        },
        mssqlDrop: {
          desc: 'drop the system tables',
          required: false,
          type: 'boolean',
          default: false
        },
        mssqlSystemTablesOnly: {
          desc: 'only create the system records',
          required: false,
          type: 'boolean',
          default: false
        }
      },
      handler: this.runCommand
    });
  }

  runCommand = async () => {
    await this.activate();

    if (fulcrum.args.mssqlCreateDatabase) {
      await this.createDatabase(fulcrum.args.mssqlCreateDatabase);
      return;
    }

    if (fulcrum.args.mssqlDropDatabase) {
      await this.dropDatabase(fulcrum.args.mssqlDropDatabase);
      return;
    }

    if (fulcrum.args.mssqlDrop) {
      await this.dropSystemTables();
      return;
    }

    if (fulcrum.args.mssqlSetup) {
      await this.setupDatabase();
      return;
    }

    const account = await fulcrum.fetchAccount(fulcrum.args.org);

    if (account) {
      if (fulcrum.args.mssqlSystemTablesOnly) {
        await this.setupSystemTables(account);
        return;
      }

      await this.invokeBeforeFunction();

      const forms = await account.findActiveForms({});

      for (const form of forms) {
        if (fulcrum.args.mssqlForm && form.id !== fulcrum.args.mssqlForm) {
          continue;
        }

        if (fulcrum.args.mssqlRebuildViewsOnly) {
          await this.rebuildFriendlyViews(form, account);
        } else {
          await this.rebuildForm(form, account, (index) => {
            this.updateStatus(form.name.green + ' : ' + index.toString().red + ' records');
          });
        }

        log('');
      }

      await this.invokeAfterFunction();
    } else {
      error('Unable to find account', fulcrum.args.org);
    }
  }

  trimIdentifier(identifier) {
    return identifier.substring(0, MAX_IDENTIFIER_LENGTH);
  }

  escapeIdentifier = (identifier) => {
    return identifier && this.mssql.ident(this.trimIdentifier(identifier));
  }

  get useSyncEvents() {
    return fulcrum.args.mssqlSyncEvents != null ? fulcrum.args.mssqlSyncEvents : true;
  }

  async activate() {
    this.account = await fulcrum.fetchAccount(fulcrum.args.org);

    const options = {
      ...MSSQL_CONFIG,
      server: fulcrum.args.mssqlHost || MSSQL_CONFIG.server,
      port: fulcrum.args.mssqlPort || MSSQL_CONFIG.port,
      database: fulcrum.args.mssqlDatabase || MSSQL_CONFIG.database,
      user: fulcrum.args.mssqlUser || MSSQL_CONFIG.user,
      password: fulcrum.args.mssqlPassword || MSSQL_CONFIG.user
    };

    if (fulcrum.args.mssqlUser) {
      options.user = fulcrum.args.mssqlUser;
    }

    if (fulcrum.args.mssqlPassword) {
      options.password = fulcrum.args.mssqlPassword;
    }

    if (fulcrum.args.mssqlCustomModule) {
      this.mssqlCustomModule = require(fulcrum.args.mssqlCustomModule);
      this.mssqlCustomModule.api = api;
      this.mssqlCustomModule.app = fulcrum;
    }

    this.disableArrays = false;
    this.disableComplexTypes = true;

    if (fulcrum.args.mssqlPersistentTableNames === true) {
      this.persistentTableNames = true;
    }

    this.useAccountPrefix = (fulcrum.args.mssqlPrefix !== false);

    this.pool = await mssql.connect(fulcrum.args.mssqlConnectionString || options);

    if (this.useSyncEvents) {
      fulcrum.on('sync:start', this.onSyncStart);
      fulcrum.on('sync:finish', this.onSyncFinish);
      fulcrum.on('photo:save', this.onPhotoSave);
      fulcrum.on('video:save', this.onVideoSave);
      fulcrum.on('audio:save', this.onAudioSave);
      fulcrum.on('signature:save', this.onSignatureSave);
      fulcrum.on('changeset:save', this.onChangesetSave);
      fulcrum.on('record:save', this.onRecordSave);
      fulcrum.on('record:delete', this.onRecordDelete);

      fulcrum.on('choice-list:save', this.onChoiceListSave);
      fulcrum.on('choice-list:delete', this.onChoiceListSave);

      fulcrum.on('form:save', this.onFormSave);
      fulcrum.on('form:delete', this.onFormSave);

      fulcrum.on('classification-set:save', this.onClassificationSetSave);
      fulcrum.on('classification-set:delete', this.onClassificationSetSave);

      fulcrum.on('role:save', this.onRoleSave);
      fulcrum.on('role:delete', this.onRoleSave);

      fulcrum.on('project:save', this.onProjectSave);
      fulcrum.on('project:delete', this.onProjectSave);

      fulcrum.on('membership:save', this.onMembershipSave);
      fulcrum.on('membership:delete', this.onMembershipSave);
    }

    this.viewSchema = fulcrum.args.mssqlSchemaViews || DEFAULT_SCHEMA;
    this.dataSchema = fulcrum.args.mssqlSchema || DEFAULT_SCHEMA;

    // Fetch all the existing tables on startup. This allows us to special case the
    // creation of new tables even when the form isn't version 1. If the table doesn't
    // exist, we can pretend the form is version 1 so it creates all new tables instead
    // of applying a schema diff.
    const rows = await this.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${ this.dataSchema }'`);

    this.tableNames = rows.map(o => o.name);

    // make a client so we can use it to build SQL statements
    this.mssql = new MSSQL({});

    this.setupOptions();

    await this.maybeInitialize();
  }

  async deactivate() {
    if (this.pool) {
      await this.pool.close();
    }
  }

  run = async (sql) => {
    sql = sql.replace(/\0/g, '');

    if (fulcrum.args.debug) {
      log(sql);
    }

    const result = await this.pool.request().batch(sql);

    return result.recordset;
  }

  runAll = async (statements) => {
    const results = [];

    for (const sql of statements) {
      results.push(await this.run(sql));
    }

    return results;
  }

  runAllTransaction = async (statements) => {
    const transaction = new mssql.Transaction(this.pool);

    await transaction.begin();

    const results = [];

    for (const sql of statements) {
      const request = new mssql.Request(transaction);

      if (fulcrum.args.debug) {
        log(sql);
      }

      const result = await request.batch(sql);

      results.push(result);
    }

    await transaction.commit();

    return results;
  }

  log = (...args) => {
    // console.log(...args);
  }

  tableName = (account, name) => {
    return 'account_' + account.rowID + '_' + name;

    if (this.useAccountPrefix) {
      return 'account_' + account.rowID + '_' + name;
    }

    return name;
  }

  onSyncStart = async ({account, tasks}) => {
    await this.invokeBeforeFunction();
  }

  onSyncFinish = async ({account}) => {
    await this.cleanupFriendlyViews(account);
    await this.invokeAfterFunction();
  }

  onFormSave = async ({form, account, oldForm, newForm}) => {
    await this.updateForm(form, account, oldForm, newForm);
  }

  onFormDelete = async ({form, account}) => {
    const oldForm = {
      id: form._id,
      row_id: form.rowID,
      name: form._name,
      elements: form._elementsJSON
    };

    await this.updateForm(form, account, oldForm, null);
  }

  onRecordSave = async ({record, account}) => {
    await this.updateRecord(record, account);
  }

  onRecordDelete = async ({record}) => {
    const statements = MSSQLRecordValues.deleteForRecordStatements(this.mssql, record, record.form, this.recordValueOptions);

    await this.run(statements.map(o => o.sql).join('\n'));
  }

  onPhotoSave = async ({photo, account}) => {
    await this.updatePhoto(photo, account);
  }

  onVideoSave = async ({video, account}) => {
    await this.updateVideo(video, account);
  }

  onAudioSave = async ({audio, account}) => {
    await this.updateAudio(audio, account);
  }

  onSignatureSave = async ({signature, account}) => {
    await this.updateSignature(signature, account);
  }

  onChangesetSave = async ({changeset, account}) => {
    await this.updateChangeset(changeset, account);
  }

  onChoiceListSave = async ({choiceList, account}) => {
    await this.updateChoiceList(choiceList, account);
  }

  onClassificationSetSave = async ({classificationSet, account}) => {
    await this.updateClassificationSet(classificationSet, account);
  }

  onProjectSave = async ({project, account}) => {
    await this.updateProject(project, account);
  }

  onRoleSave = async ({role, account}) => {
    await this.updateRole(role, account);
  }

  onMembershipSave = async ({membership, account}) => {
    await this.updateMembership(membership, account);
  }

  async updatePhoto(object, account) {
    const values = SchemaMap.photo(object);

    values.file = this.formatPhotoURL(values.access_key);

    await this.updateObject(values, 'photos');
  }

  async updateVideo(object, account) {
    const values = SchemaMap.video(object);

    values.file = this.formatVideoURL(values.access_key);

    await this.updateObject(values, 'videos');
  }

  async updateAudio(object, account) {
    const values = SchemaMap.audio(object);

    values.file = this.formatAudioURL(values.access_key);

    await this.updateObject(values, 'audio');
  }

  async updateSignature(object, account) {
    const values = SchemaMap.signature(object);

    values.file = this.formatSignatureURL(values.access_key);

    await this.updateObject(values, 'signatures');
  }

  async updateChangeset(object, account) {
    await this.updateObject(SchemaMap.changeset(object), 'changesets');
  }

  async updateProject(object, account) {
    await this.updateObject(SchemaMap.project(object), 'projects');
  }

  async updateMembership(object, account) {
    await this.updateObject(SchemaMap.membership(object), 'memberships');
  }

  async updateRole(object, account) {
    await this.updateObject(SchemaMap.role(object), 'roles');
  }

  async updateFormObject(object, account) {
    await this.updateObject(SchemaMap.form(object), 'forms');
  }

  async updateChoiceList(object, account) {
    await this.updateObject(SchemaMap.choiceList(object), 'choice_lists');
  }

  async updateClassificationSet(object, account) {
    await this.updateObject(SchemaMap.classificationSet(object), 'classification_sets');
  }

  async updateObject(values, table) {
    const deleteStatement = this.mssql.deleteStatement(`${ this.dataSchema }.system_${table}`, {row_resource_id: values.row_resource_id});
    const insertStatement = this.mssql.insertStatement(`${ this.dataSchema }.system_${table}`, values, {pk: 'id'});

    const sql = [ deleteStatement.sql, insertStatement.sql ].join('\n');

    try {
      await this.run(sql);
    } catch (ex) {
      warn(`updateObject ${table} failed`);
      this.integrityWarning(ex);
      throw ex;
    }
  }

  reloadTableList = async () => {
    const rows = await this.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${ this.dataSchema }'`);

    this.tableNames = rows.map(o => o.name);
  }

  reloadViewList = async () => {
    const rows = await this.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${ this.viewSchema }'`);

    this.viewNames = rows.map(o => o.name);
  }

  baseMediaURL = () => {
  }

  formatPhotoURL = (id) => {
    return `${ this.baseMediaURL }/photos/${ id }.jpg`;
  }

  formatVideoURL = (id) => {
    return `${ this.baseMediaURL }/videos/${ id }.mp4`;
  }

  formatAudioURL = (id) => {
    return `${ this.baseMediaURL }/audio/${ id }.m4a`;
  }

  formatSignatureURL = (id) => {
    return `${ this.baseMediaURL }/signatures/${ id }.png`;
  }

  integrityWarning(ex) {
    warn(`
-------------
!! WARNING !!
-------------

MSSQL database integrity issue encountered. Common sources of database issues are:

* Reinstalling Fulcrum Desktop and using an old MSSQL database without recreating
  the MSSQL database.
* Deleting the internal application database and using an existing MSSQL database
* Manually modifying the MSSQL database
* Creating multiple apps in Fulcrum with the same name. This is generally OK, except
  you will not be able to use the "friendly view" feature of the MSSQL plugin since
  the view names are derived from the form names.

Note: When reinstalling Fulcrum Desktop or "starting over" you need to drop and re-create
the MSSQL database. The names of database objects are tied directly to the database
objects in the internal application database.

---------------------------------------------------------------------
Report issues at https://github.com/fulcrumapp/fulcrum-desktop/issues
---------------------------------------------------------------------
Message:
${ ex.message }

Stack:
${ ex.stack }
---------------------------------------------------------------------
`.red
    );
  }

  setupOptions() {
    this.baseMediaURL = fulcrum.args.mssqlMediaBaseUrl ? fulcrum.args.mssqlMediaBaseUrl : 'https://api.fulcrumapp.com/api/v2';

    this.recordValueOptions = {
      schema: this.dataSchema,

      escapeIdentifier: this.escapeIdentifier,

      disableArrays: this.disableArrays,

      persistentTableNames: this.persistentTableNames,

      accountPrefix: this.useAccountPrefix ? 'account_' + this.account.rowID : null,

      calculatedFieldDateFormat: 'date',

      disableComplexTypes: this.disableComplexTypes,

      valuesTransformer: this.mssqlCustomModule && this.mssqlCustomModule.valuesTransformer,

      mediaURLFormatter: (mediaValue) => {

        return mediaValue.items.map((item) => {
          if (mediaValue.element.isPhotoElement) {
            return this.formatPhotoURL(item.mediaID);
          } else if (mediaValue.element.isVideoElement) {
            return this.formatVideoURL(item.mediaID);
          } else if (mediaValue.element.isAudioElement) {
            return this.formatAudioURL(item.mediaID);
          }

          return null;
        });
      },

      mediaViewURLFormatter: (mediaValue) => {
        const ids = mediaValue.items.map(o => o.mediaID);

        if (mediaValue.element.isPhotoElement) {
          return `${ this.baseMediaURL }/photos/view?photos=${ ids }`;
        } else if (mediaValue.element.isVideoElement) {
          return `${ this.baseMediaURL }/videos/view?videos=${ ids }`;
        } else if (mediaValue.element.isAudioElement) {
          return `${ this.baseMediaURL }/audio/view?audio=${ ids }`;
        }

        return null;
      }
    };

    if (fulcrum.args.mssqlReportBaseUrl) {
      this.recordValueOptions.reportURLFormatter = (feature) => {
        return `${ fulcrum.args.mssqlReportBaseUrl }/reports/${ feature.id }.pdf`;
      };
    }
  }

  updateRecord = async (record, account, skipTableCheck) => {
    if (!skipTableCheck && !this.rootTableExists(record.form)) {
      await this.rebuildForm(record.form, account, () => {});
    }

    if (this.mssqlCustomModule && this.mssqlCustomModule.shouldUpdateRecord && !this.mssqlCustomModule.shouldUpdateRecord({record, account})) {
      return;
    }

    const statements = MSSQLRecordValues.updateForRecordStatements(this.mssql, record, this.recordValueOptions);

    await this.run(statements.map(o => o.sql).join('\n'));

    const systemValues = MSSQLRecordValues.systemColumnValuesForFeature(record, null, record, this.recordValueOptions);

    await this.updateObject(SchemaMap.record(record, systemValues), 'records');
  }

  rootTableExists = (form) => {
    return this.tableNames.indexOf(MSSQLRecordValues.tableNameWithForm(form, null, this.recordValueOptions)) !== -1;
  }

  recreateFormTables = async (form, account) => {
    try {
      await this.updateForm(form, account, this.formVersion(form), null);
    } catch (ex) {
      if (fulcrum.args.debug) {
        error(ex);
      }
    }

    await this.updateForm(form, account, null, this.formVersion(form));
  }

  updateForm = async (form, account, oldForm, newForm) => {
    if (this.mssqlCustomModule && this.mssqlCustomModule.shouldUpdateForm && !this.mssqlCustomModule.shouldUpdateForm({form, account})) {
      return;
    }

    try {
      info('Updating form', form.id);

      await this.updateFormObject(form, account);

      if (!this.rootTableExists(form) && newForm != null) {
        oldForm = null;
      }

      const options = {
        disableArrays: this.disableArrays,
        disableComplexTypes: false,
        userModule: this.mssqlCustomModule,
        tableSchema: this.dataSchema,
        calculatedFieldDateFormat: 'date',
        metadata: true,
        useResourceID: this.persistentTableNames,
        accountPrefix: this.useAccountPrefix ? 'account_' + this.account.rowID : null
      };

      const {statements} = await MSSQLSchema.generateSchemaStatements(account, oldForm, newForm, options);

      info('Dropping views', form.id);

      await this.dropFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        await this.dropFriendlyView(form, repeatable);
      }

      info('Running schema statements', form.id, statements.length);

      info('Schema statements', '\n', statements.join('\n'));

      await this.runAllTransaction(statements);

      info('Creating views', form.id);

      if (newForm) {
        await this.createFriendlyView(form, null);

        for (const repeatable of form.elementsOfType('Repeatable')) {
          await this.createFriendlyView(form, repeatable);
        }
      }

      info('Completed form update', form.id);
    } catch (ex) {
      info('updateForm failed');
      this.integrityWarning(ex);
      throw ex;
    }
  }

  async dropFriendlyView(form, repeatable) {
    const viewName = this.getFriendlyTableName(form, repeatable);

    try {
      await this.run(format("IF OBJECT_ID('%s.%s', 'V') IS NOT NULL DROP VIEW %s.%s;",
                            this.escapeIdentifier(this.viewSchema), this.escapeIdentifier(viewName),
                            this.escapeIdentifier(this.viewSchema), this.escapeIdentifier(viewName)));
    } catch (ex) {
      warn('dropFriendlyView failed');
      this.integrityWarning(ex);
    }
  }

  async createFriendlyView(form, repeatable) {
    const viewName = this.getFriendlyTableName(form, repeatable);

    try {
      await this.run(format('CREATE VIEW %s.%s AS SELECT * FROM %s;',
                            this.escapeIdentifier(this.viewSchema),
                            this.escapeIdentifier(viewName),
                            MSSQLRecordValues.tableNameWithFormAndSchema(form, repeatable, this.recordValueOptions, '_view_full')));
    } catch (ex) {
      // sometimes it doesn't exist
      warn('createFriendlyView failed');
      this.integrityWarning(ex);
    }
  }

  getFriendlyTableName(form, repeatable) {
    const name = compact([form.name, repeatable && repeatable.dataName]).join(' - ')

    const formID = this.persistentTableNames ? form.id : form.rowID;

    const prefix = compact(['view', formID, repeatable && repeatable.key]).join(' - ');

    const objectName = [prefix, name].join(' - ');

    return this.trimIdentifier(fulcrum.args.mssqlUnderscoreNames !== false ? snake(objectName) : objectName);
  }

  async invokeBeforeFunction() {
    if (fulcrum.args.mssqlBeforeFunction) {
      await this.run(format('EXECUTE %s;', fulcrum.args.mssqlBeforeFunction));
    }
    if (this.mssqlCustomModule && this.mssqlCustomModule.beforeSync) {
      await this.mssqlCustomModule.beforeSync();
    }
  }

  async invokeAfterFunction() {
    if (fulcrum.args.mssqlAfterFunction) {
      await this.run(format('EXECUTE %s;', fulcrum.args.mssqlAfterFunction));
    }
    if (this.mssqlCustomModule && this.mssqlCustomModule.afterSync) {
      await this.mssqlCustomModule.afterSync();
    }
  }

  async rebuildForm(form, account, progress) {
    await this.recreateFormTables(form, account);
    await this.reloadTableList();

    let index = 0;

    await form.findEachRecord({}, async (record) => {
      record.form = form;

      if (++index % 10 === 0) {
        progress(index);
      }

      await this.updateRecord(record, account, true);
    });

    progress(index);
  }

  async cleanupFriendlyViews(account) {
    await this.reloadViewList();

    const activeViewNames = [];

    const forms = await account.findActiveForms({});

    for (const form of forms) {
      activeViewNames.push(this.getFriendlyTableName(form, null));

      for (const repeatable of form.elementsOfType('Repeatable')) {
        activeViewNames.push(this.getFriendlyTableName(form, repeatable));
      }
    }

    const remove = difference(this.viewNames, activeViewNames);

    for (const viewName of remove) {
      if (viewName.indexOf('view_') === 0 || viewName.indexOf('view - ') === 0) {
        try {
          await this.run(format("IF OBJECT_ID('%s.%s', 'V') IS NOT NULL DROP VIEW %s.%s;",
                                this.escapeIdentifier(this.viewSchema), this.escapeIdentifier(viewName),
                                this.escapeIdentifier(this.viewSchema), this.escapeIdentifier(viewName)));
        } catch (ex) {
          warn('cleanupFriendlyViews failed');
          this.integrityWarning(ex);
        }
      }
    }
  }

  async rebuildFriendlyViews(form, account) {
    await this.dropFriendlyView(form, null);

    for (const repeatable of form.elementsOfType('Repeatable')) {
      await this.dropFriendlyView(form, repeatable);
    }

    await this.createFriendlyView(form, null);

    for (const repeatable of form.elementsOfType('Repeatable')) {
      await this.createFriendlyView(form, repeatable);
    }
  }

  formVersion = (form) => {
    if (form == null) {
      return null;
    }

    return {
      id: form._id,
      row_id: form.rowID,
      name: form._name,
      elements: form._elementsJSON
    };
  }

  updateStatus = (message) => {
    if (process.stdout.isTTY) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(message);
    }
  }

  async dropSystemTables() {
    await this.runAll(this.prepareMigrationScript(templateDrop));
  }

  createDatabase(databaseName) {
    log('Creating database', databaseName);
    return this.run(`CREATE DATABASE ${databaseName};`);
  }

  dropDatabase(databaseName) {
    log('Dropping database', databaseName);
    return this.run(`DROP DATABASE ${databaseName};`);
  }

  async setupDatabase() {
    await this.runAll(this.prepareMigrationScript(version001));
  }

  prepareMigrationScript(sql) {
    return sql.replace(/__SCHEMA__/g, this.dataSchema)
              .replace(/__VIEW_SCHEMA__/g, this.viewSchema).split(';');
  }

  async setupSystemTables(account) {
    const progress = (name, index) => {
      this.updateStatus(name.green + ' : ' + index.toString().red);
    };

    await account.findEachPhoto({}, async (photo, {index}) => {
      if (++index % 10 === 0) {
        progress('Photos', index);
      }

      await this.updatePhoto(photo, account);
    });

    await account.findEachVideo({}, async (video, {index}) => {
      if (++index % 10 === 0) {
        progress('Videos', index);
      }

      await this.updateVideo(video, account);
    });

    await account.findEachAudio({}, async (audio, {index}) => {
      if (++index % 10 === 0) {
        progress('Audio', index);
      }

      await this.updateAudio(audio, account);
    });

    await account.findEachSignature({}, async (signature, {index}) => {
      if (++index % 10 === 0) {
        progress('Signatures', index);
      }

      await this.updateSignature(signature, account);
    });

    await account.findEachChangeset({}, async (changeset, {index}) => {
      if (++index % 10 === 0) {
        progress('Changesets', index);
      }

      await this.updateChangeset(changeset, account);
    });

    await account.findEachRole({}, async (object, {index}) => {
      if (++index % 10 === 0) {
        progress('Roles', index);
      }

      await this.updateRole(object, account);
    });

    await account.findEachProject({}, async (object, {index}) => {
      if (++index % 10 === 0) {
        progress('Projects', index);
      }

      await this.updateProject(object, account);
    });

    await account.findEachForm({}, async (object, {index}) => {
      if (++index % 10 === 0) {
        progress('Forms', index);
      }

      await this.updateFormObject(object, account);
    });

    await account.findEachMembership({}, async (object, {index}) => {
      if (++index % 10 === 0) {
        progress('Memberships', index);
      }

      await this.updateMembership(object, account);
    });

    await account.findEachChoiceList({}, async (object, {index}) => {
      if (++index % 10 === 0) {
        progress('Choice Lists', index);
      }

      await this.updateChoiceList(object, account);
    });

    await account.findEachClassificationSet({}, async (object, {index}) => {
      if (++index % 10 === 0) {
        progress('Classification Sets', index);
      }

      await this.updateClassificationSet(object, account);
    });
  }

  get isAutomaticInitializationDisabled() {
    return fulcrum.args.mssqlCreateDatabase ||
      fulcrum.args.mssqlDropDatabase ||
      fulcrum.args.mssqlDrop ||
      fulcrum.args.mssqlSetup;
  }

  async maybeInitialize() {
    if (this.isAutomaticInitializationDisabled) {
      return;
    }

    const account = await fulcrum.fetchAccount(fulcrum.args.org);

    if (this.tableNames.indexOf('migrations') === -1) {
      log('Inititalizing database...');

      await this.setupDatabase();
    }

    await this.maybeRunMigrations(account);
  }

  async maybeRunMigrations(account) {
    this.migrations = (await this.run(`SELECT name FROM ${ this.dataSchema }.migrations`)).map(o => o.name);

    let populateRecords = false;

    for (let count = 2; count <= CURRENT_VERSION; ++count) {
      const version = padStart(count, 3, '0');

      const needsMigration = this.migrations.indexOf(version) === -1 && MIGRATIONS[version];

      if (needsMigration) {
        await this.runAll(this.prepareMigrationScript(MIGRATIONS[version]));

        if (version === '002') {
          log('Populating system tables...');
          populateRecords = true;
        }
        else if (version === '005') {
          log('Migrating date calculation fields...');
          await this.migrateCalculatedFieldsDateFormat(account);
        }
      }
    }

    if (populateRecords) {
      await this.populateRecords(account);
    }
  }

  async populateRecords(account) {
    const forms = await account.findActiveForms({});

    let index = 0;

    for (const form of forms) {
      index = 0;

      await form.findEachRecord({}, async (record) => {
        record.form = form;

        if (++index % 10 === 0) {
          this.progress(form.name, index);
        }

        await this.updateRecord(record, account, false);
      });
    }
  }

  async migrateCalculatedFieldsDateFormat(account) {
    const forms = await account.findActiveForms({});

    for (const form of forms) {
      const fields = form.elementsOfType('CalculatedField').filter(element => element.display.isDate);

      if (fields.length) {
        log('Migrating date calculation fields in form...', form.name);

        await this.rebuildForm(form, account, () => {});
      }
    }
  }

  progress = (name, index) => {
    this.updateStatus(name.green + ' : ' + index.toString().red);
  }
}
