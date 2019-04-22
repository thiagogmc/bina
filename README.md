# Bina

A web App to search in a LDAP for users and contacts.

## Requirements

* NodeJS 6.x or newer

## Running

### Standalone

#### Install dependencies

    npm install && npm run build && npm run copy-env
or

    yarn && yarn run build && yarn run copy-env
    
#### Configuring

After install, edit file `.env` and set variables.
    
#### Start app
    npm start

If you need, use a third parameter to provide a config file (`.env` renamed for alternative or testing environment). 

## With Docker

  Copy `.env-example` to `.env` and edit variables.
  
Run:

    docker build -t bina .
    docker run -p 3000:3000 --env-file .env bina

or

    docker-compose up -d

## Debugging

Before running app, set environment variable `DEBUG`:

    DEBUG=Bina:* npm start

## Importing addressbook to voip phones

Just config to sync with url: `http://<binaServer>/contacts/<brand>.xml`

Brand options:
* Yealink
* Grandstream

## Add more than one LDAP server

Just separate the parameters at .env with `;;`

    LDAP_HOST=ldaps://192.168.0.1;;ldaps://192.168.0.2
    LDAP_USER=user@domain.com;;user@domain2.com
    LDAP_PASS=P455w0rd;;P455w0rd2
    LDAP_BASE=ou=Organizational Unit,dc=domain,dc=com;;ou=Organizational Unit2,dc=domain2,dc=com2