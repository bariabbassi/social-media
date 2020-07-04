const firebase = require('firebase');
const config = require('./util/config');
const functions = require('firebase-functions');
const app = require('express')();
const fbAuth = require('./util/fbAuth');
const { getAllScreams, getOneScream } = require('./handlers/screams');
const { signup, login, addUserDetails } = require('./handlers/users');

// Scream routes
app.get('/screams', getAllScreams);
app.post('/scream', fbAuth, getOneScream);

// Users routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/user', fbAuth, addUserDetails);

exports.api = functions.region('europe-west1').https.onRequest(app);