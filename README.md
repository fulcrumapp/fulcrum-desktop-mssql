## Fulcrum Desktop Microsoft SQL Server

Sync Fulcrum data to SQL Server.

### Initial setup

Setup and sync Desktop first
```sh
cd AppData\Local\Programs\Fulcrum\scripts
fulcrum.cmd setup --email EMAIL --password SECRET
fulcrum.cmd sync --org "Organization Name"
```

### Install plugin

```sh
fulcrum install-plugin --url https://github.com/fulcrumapp/fulcrum-desktop-mssql
```

### Setup plugin

```sh
# Create the database
fulcrum mssql --setup --org "Fulcrum Account Name" --msuser USERNAME --mspassword PASSWORD --mshost "localhost"
```

### Sync a Form

```
fulcrum mssql --org 'Fulcrum Account Name' --msuser USERNAME --mspassword PASSWORD --mshost HOSTNAME
```

### Keep it up to date

```
fulcrum sync --org 'Fulcrum Account Name' --msuser USERNAME --mspassword PASSWORD --mshost HOSTNAME
```
