# daily-page

Tool for creating a collaborative, textual record for each day. Derived from the [Conclave project](https://github.com/conclave-team/conclave).

Prerequisite: Mongo DB deployment.

```
export APP_AUTH=#string of your choice for use in authentication with the backend
export MONGO_DB_ADDR=#your Mongo DB deployment address
export MONGO_DB_PW=#your Mongo DB password
npm install
npm run local
```