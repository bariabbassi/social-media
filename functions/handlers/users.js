const firebase = require('firebase');
const config = require('../util/config');
const { admin, db } =  require('../util/admin');
const { uuid } = require('uuidv4');

firebase.initializeApp(config);

const isEmpty = (string) => {
    if(string.trim() === '') return true;
    return false;
}

const isEmail = (email) => {
    const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if(email.match(regEx)) return true;
    return false;
}

exports.signup = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    let errors = {};
    if(isEmpty(newUser.email)) errors.email = 'Email must not be empty';
    else if(!isEmail(newUser.email)) errors.email = 'Email must be a valid email';
    if(isEmpty(newUser.password)) errors.password = 'Password must not be empty';
    if(newUser.password !== newUser.confirmPassword) errors.confirmPassword = 'Passwords must match';
    if(isEmpty(newUser.handle)) errors.handle = 'Handle must not be empty';
    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    let token, userId;
    db.doc(`/users/${newUser.handle}`).get()
    .then(doc => {
        if(doc.exists){
            return res.status(400).json({ handle: 'handle is already taken' });
        } else {
            return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password);
        }
    })
    .then(data => {
        userId = data.user.uid;
        return data.user.getIdToken()
    })
    .then(idToken => {
        token = idToken;
        const userCredentials = {
            handle: newUser.handle,
            email: newUser.email,
            createdAt: new Date().toISOString(),
            userId
        };
        return db.doc(`/users/${newUser.handle}`).set(userCredentials);
    })
    .then(() => res.status(201).json({ token }))
    .catch(err => {
        console.error(err);
        if (err.code === 'auth/email-already-in-use') {
            return res.status(400).json({ email: 'Email is already is use' });
        }
            res.status(500).json({ error: err.code });
    });
};

exports.login = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    };

    let errors = {};
    if(isEmpty(user.email)) errors.email = 'Email must not me empty';
    else if(!isEmail(user.email)) errors.email = 'Email must be a valid email';
    if(isEmpty(user.password)) errors.password = 'Password must not me empty';
    if(Object.keys(errors).length > 0) return res.status(400).json(errors);

    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
    .then(data => data.user.getIdToken())
    .then(token => res.json({ token }))
    .catch(err => {
        console.error(err);
        if (err.code === 'auth/wrong-password') {
            return res.status(403).json({ general: 'Wrong credentials, please try again' });
        }
        res.status(500).json({ error: err.code });
    });
};

exports.addUserDetails = (req, res) => {
  // TODO: add verification
  // if (req.body.bio.trim() === '') {
  //     return res.status(400).json({ body: 'Bio must not be empty' });
  // }

  const userDetails = {
      bio: req.body.bio,
      website: req.body.website,
      location: req.body.location
  };

  db.doc(`users/${req.user.handle}`).update(userDetails)
  .then(doc => {return res.json({ message: 'Details added successfully'})})
  .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
  });
};