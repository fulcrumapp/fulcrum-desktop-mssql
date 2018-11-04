import mssql from 'mssql';
import { format } from 'util';
import MSSQLSchema from './schema';
import { MSSQL } from 'fulcrum';
import MSSQLRecordValues from './mssql-record-values'
import snake from 'snake-case';
import templateDrop from './template.drop.sql';
import SchemaMap from './schema-map';
import * as api from 'fulcrum';

import version001 from './version-001.sql';
import version002 from './version-002.sql';
import version003 from './version-003.sql';

const MAX_IDENTIFIER_LENGTH = 63;

const MSSQL_CONFIG = {
  database: 'fulcrumapp',
  server: 'localhost',
  port: 1433,
  max: 10,
  idleTimeoutMillis: 30000
};

const MIGRATIONS = {
  '002': version002,
  '003': version003
};

const DEFAULT_SCHEMA = 'dbo';

export default class {
  async task(cli) {
    return cli.command({
      command: 'mssql',
      desc: 'run the mssql sync for a specific organization',
      builder: {
        msConnectionString: {
          desc: 'mssql connection string (overrides all individual database connection parameters)',
          type: 'string'
        },
        msDatabase: {
          desc: 'mssql database name',
          type: 'string',
          default: MSSQL_CONFIG.database
        },
        msHost: {
          desc: 'mssql server host',
          type: 'string',
          default: MSSQL_CONFIG.host
        },
        msPort: {
          desc: 'mssql server port',
          type: 'integer',
          default: MSSQL_CONFIG.port
        },
        msUser: {
          desc: 'mssql user',
          type: 'string'
        },
        msPassword: {
          desc: 'mssql password',
          type: 'string'
        },
        msSchema: {
          desc: 'mssql schema',
          type: 'string'
        },
        msSchemaViews: {
          desc: 'mssql schema for the friendly views',
          type: 'string'
        },
        msSyncEvents: {
          desc: 'add sync event hooks',
          type: 'boolean',
          default: true
        },
        msBeforeFunction: {
          desc: 'call this function before the sync',
          type: 'string'
        },
        msAfterFunction: {
          desc: 'call this function after the sync',
          type: 'string'
        },
        org: {
          desc: 'organization name',
          required: true,
          type: 'string'
        },
        msForm: {
          desc: 'the form ID to rebuild',
          type: 'string'
        },
        msReportBaseUrl: {
          desc: 'report URL base',
          type: 'string'
        },
        msMediaBaseUrl: {
          desc: 'media URL base',
          type: 'string'
        },
        msUnderscoreNames: {
          desc: 'use underscore names (e.g. "Park Inspections" becomes "park_inspections")',
          required: false,
          type: 'boolean',
          default: false
        },
        msRebuildViewsOnly: {
          desc: 'only rebuild the views',
          required: false,
          type: 'boolean',
          default: false
        },
        msCustomModule: {
          desc: 'a custom module to load with sync extensions (experimental)',
          required: false,
          type: 'string'
        },
        msSetup: {
          desc: 'setup the database',
          required: false,
          type: 'boolean'
        },
        msDrop: {
          desc: 'drop the system tables',
          required: false,
          type: 'boolean',
          default: false
        },
        msSystemTablesOnly: {
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

    if (fulcrum.args.msDrop) {
      await this.dropSystemTables();
      return;
    }

    if (fulcrum.args.msSetup) {
      await this.setupDatabase();
      return;
    }

    const account = await fulcrum.fetchAccount(fulcrum.args.org);

    if (account) {
      if (fulcrum.args.msSystemTablesOnly) {
        await this.setupSystemTables(account);
        return;
      }

      await this.invokeBeforeFunction();

      const forms = await account.findActiveForms({});

      for (const form of forms) {
        if (fulcrum.args.msForm && form.id !== fulcrum.args.msForm) {
          continue;
        }

        if (fulcrum.args.msRebuildViewsOnly) {
          await this.rebuildFriendlyViews(form, account);
        } else {
          await this.rebuildForm(form, account, (index) => {
            this.updateStatus(form.name.green + ' : ' + index.toString().red + ' records');
          });
        }

        console.log('');
      }

      await this.invokeAfterFunction();
    } else {
      console.error('Unable to find account', fulcrum.args.org);
    }
  }

  escapeIdentifier(identifier) {
    return identifier && this.mssql.ident(identifier.substring(0, MAX_IDENTIFIER_LENGTH));
  }

  get useSyncEvents() {
    return fulcrum.args.msSyncEvents != null ? fulcrum.args.msSyncEvents : true;
  }

  async activate() {
    const options = {
      ...MSSQL_CONFIG,
      server: fulcrum.args.msHost || MSSQL_CONFIG.server,
      port: fulcrum.args.msPort || MSSQL_CONFIG.port,
      database: fulcrum.args.msDatabase || MSSQL_CONFIG.database,
      user: fulcrum.args.msUser || MSSQL_CONFIG.user,
      password: fulcrum.args.msPassword || MSSQL_CONFIG.user
    };

    if (fulcrum.args.msUser) {
      options.user = fulcrum.args.msUser;
    }

    if (fulcrum.args.msPassword) {
      options.password = fulcrum.args.msPassword;
    }

    if (fulcrum.args.msCustomModule) {
      this.msCustomModule = require(fulcrum.args.msCustomModule);
      this.msCustomModule.api = api;
      this.msCustomModule.app = fulcrum;
    }

    this.disableArrays = false;
    this.disableComplexTypes = true;

    this.pool = await mssql.connect(fulcrum.args.msConnectionString || options);

    if (this.useSyncEvents) {
      fulcrum.on('sync:start', this.onSyncStart);
      fulcrum.on('sync:finish', this.onSyncFinish);
      fulcrum.on('photo:save', this.onPhotoSave);
      fulcrum.on('video:save', this.onVideoSave);
      fulcrum.on('audio:save', this.onAudioSave);
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

    this.viewSchema = fulcrum.args.msSchemaViews || DEFAULT_SCHEMA;
    this.dataSchema = fulcrum.args.msSchema || DEFAULT_SCHEMA;

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
      console.log(sql);
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

  log = (...args) => {
    // console.log(...args);
  }

  tableName = (account, name) => {
    return 'account_' + account.rowID + '_' + name;
  }

  onSyncStart = async ({account, tasks}) => {
    await this.invokeBeforeFunction();
  }

  onSyncFinish = async ({account}) => {
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
      this.integrityWarning(ex);
      throw ex;
    }
  }

  reloadTableList = async () => {
    const rows = await this.run(`SELECT table_name AS name FROM information_schema.tables WHERE table_schema='${ this.dataSchema }'`);

    this.tableNames = rows.map(o => o.name);
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

  integrityWarning(ex) {
    console.warn(`
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
    this.baseMediaURL = fulcrum.args.msMediaBaseUrl ? fulcrum.args.msMediaBaseUrl : 'https://api.fulcrumapp.com/api/v2';

    this.recordValueOptions = {
      schema: this.dataSchema,

      disableArrays: this.disableArrays,

      disableComplexTypes: this.disableComplexTypes,

      valuesTransformer: this.msCustomModule && this.msCustomModule.valuesTransformer,

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

    if (fulcrum.args.msReportBaseUrl) {
      this.recordValueOptions.reportURLFormatter = (feature) => {
        return `${ fulcrum.args.msReportBaseUrl }/reports/${ feature.id }.pdf`;
      };
    }
  }

  updateRecord = async (record, account, skipTableCheck) => {
    if (!skipTableCheck && !this.rootTableExists(record.form)) {
      await this.rebuildForm(record.form, account, () => {});
    }

    if (this.msCustomModule && this.msCustomModule.shouldUpdateRecord && !this.msCustomModule.shouldUpdateRecord({record, account})) {
      return;
    }

    const statements = MSSQLRecordValues.updateForRecordStatements(this.mssql, record, this.recordValueOptions);

    await this.run(statements.map(o => o.sql).join('\n'));

    const systemValues = MSSQLRecordValues.systemColumnValuesForFeature(record, null, record, this.recordValueOptions);

    await this.updateObject(SchemaMap.record(record, systemValues), 'records');
  }

  rootTableExists = (form) => {
    return this.tableNames.indexOf(MSSQLRecordValues.tableNameWithForm(form)) !== -1;
  }

  recreateFormTables = async (form, account) => {
    try {
      await this.updateForm(form, account, this.formVersion(form), null);
    } catch (ex) {
      if (fulcrum.args.debug) {
        console.error(sql);
      }
    }

    await this.updateForm(form, account, null, this.formVersion(form));
  }

  updateForm = async (form, account, oldForm, newForm) => {
    if (this.msCustomModule && this.msCustomModule.shouldUpdateForm && !this.msCustomModule.shouldUpdateForm({form, account})) {
      return;
    }

    try {
      await this.updateFormObject(form, account);

      if (!this.rootTableExists(form) && newForm != null) {
        oldForm = null;
      }

      const {statements} = await MSSQLSchema.generateSchemaStatements(account, oldForm, newForm, this.disableArrays,
        false /* disableComplexTypes */, this.msCustomModule, this.dataSchema);

      await this.dropFriendlyView(form, null);

      for (const repeatable of form.elementsOfType('Repeatable')) {
        await this.dropFriendlyView(form, repeatable);
      }

      await this.runAll(['BEGIN TRANSACTION;',
                         ...statements,
                         'COMMIT TRANSACTION;']);

      if (newForm) {
        await this.createFriendlyView(form, null);

        for (const repeatable of form.elementsOfType('Repeatable')) {
          await this.createFriendlyView(form, repeatable);
        }
      }
    } catch (ex) {
      this.integrityWarning(ex);
      throw ex;
    }
  }

  async dropFriendlyView(form, repeatable) {
    const viewName = this.getFriendlyTableName(form, repeatable);

    try {
      await this.run(format('DROP VIEW IF EXISTS %s.%s;', this.escapeIdentifier(this.viewSchema), this.escapeIdentifier(viewName)));
    } catch (ex) {
      this.integrityWarning(ex);
    }
  }

  async createFriendlyView(form, repeatable) {
    const viewName = this.getFriendlyTableName(form, repeatable);

    try {
      await this.run(format('CREATE VIEW %s.%s AS SELECT * FROM %s.%s_view_full;',
                            this.escapeIdentifier(this.viewSchema),
                            this.escapeIdentifier(viewName),
                            this.escapeIdentifier(this.dataSchema),
                            MSSQLRecordValues.tableNameWithForm(form, repeatable)));
    } catch (ex) {
      // sometimes it doesn't exist
      this.integrityWarning(ex);
    }
  }

  getFriendlyTableName(form, repeatable) {
    const name = repeatable ? `${form.name} - ${repeatable.dataName}` : form.name;

    return fulcrum.args.msUnderscoreNames ? snake(name) : name;
  }

  async invokeBeforeFunction() {
    if (fulcrum.args.msBeforeFunction) {
      await this.run(format('EXECUTE %s;', fulcrum.args.msBeforeFunction));
    }
    if (this.msCustomModule && this.msCustomModule.beforeSync) {
      await this.msCustomModule.beforeSync();
    }
  }

  async invokeAfterFunction() {
    if (fulcrum.args.msAfterFunction) {
      await this.run(format('EXECUTE %s;', fulcrum.args.msAfterFunction));
    }
    if (this.msCustomModule && this.msCustomModule.afterSync) {
      await this.msCustomModule.afterSync();
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

  async setupDatabase() {
    // console.log('SCRIPT\n', this.prepareMigrationScript(version001));
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

  async maybeInitialize() {
    const account = await fulcrum.fetchAccount(fulcrum.args.org);

    if (this.tableNames.indexOf('migrations') === -1) {
      console.log('Inititalizing database...');

      await this.setupDatabase();
    }

    await this.maybeRunMigrations(account);
  }

  async maybeRunMigrations(account) {
    this.migrations = (await this.run(`SELECT name FROM ${ this.dataSchema }.migrations`)).map(o => o.name);

    await this.maybeRunMigration('002', account);
    await this.maybeRunMigration('003', account);
  }

  async maybeRunMigration(version, account) {
    if (this.migrations.indexOf(version) === -1 && MIGRATIONS[version]) {
      await this.runAll(this.prepareMigrationScript(MIGRATIONS[version]));

      if (version === '002') {
        console.log('Populating system tables...');

        // await this.setupSystemTables(account);
        await this.populateRecords(account);
      }
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

  progress = (name, index) => {
    this.updateStatus(name.green + ' : ' + index.toString().red);
  }
}
