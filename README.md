## Fulcrum Desktop Microsoft SQL Server

Sync Fulcrum data to SQL Server.

### Installation

```sh
fulcrum install-plugin --url https://github.com/fulcrumapp/fulcrum-desktop-mssql
```

### Setup

```sh
# Create the database
fulcrum mssql --setup --msuser USERNAME --mspassword PASSWORD --mshost HOSTNAME
```

### Sync a Form

```
fulcrum mssql --org 'Fulcrum Account Name' --msuser USERNAME --mspassword PASSWORD --mshost HOSTNAME
```

### Keep it up to date

```
fulcrum sync --org 'Fulcrum Account Name' --msuser USERNAME --mspassword PASSWORD --mshost HOSTNAME
```
