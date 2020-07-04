const firebase = require('firebase');
const config = require('../util/config');
const { admin, db } =  require('../util/admin');
const { uuid } = require('uuidv4');
const {
  validateSignupData,
  validateLoginData,
  reduceUserDetails,
} = require("../util/validators");

firebase.initializeApp(config);

exports.signup = (req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    };

    const { valid, errors } = validateSignupData(newUser);
    if (!valid) return res.status(400).json(errors);

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
    const { valid, errors } = validateLoginData(user);
    if (!valid) return res.status(400).json(errors);

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
  const userDetails = reduceUserDetails(req.body);

  db.doc(`users/${req.user.handle}`).update(userDetails)
  .then(doc => {return res.json({ message: 'Details added successfully'})})
  .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
  });
};

exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  db.doc(`/users/${req.user.handle}`)
  .get()
  .then((doc) => {
    if (doc.exists) {
      userData.credentials = doc.data();
      return db
        .collection("likes")
        .where("userHandle", "==", req.user.handle)
        .get();
    }
  })
  .then((data) => {
    userData.likes = [];
    data.forEach((doc) => {
      userData.likes.push(doc.data());
    });
    return db
      .collection("notifications")
      .where("recipient", "==", req.user.handle)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();
  })
  .then((data) => {
    userData.notifications = [];
    data.forEach((doc) => {
      userData.notifications.push({
        recipient: doc.data().recipient,
        sender: doc.data().sender,
        createdAt: doc.data().createdAt,
        screamId: doc.data().screamId,
        type: doc.data().type,
        read: doc.data().read,
        notificationId: doc.id,
      });
    });
    return res.json(userData);
  })
  .catch((err) => {
    console.error(err);
    return res.status(500).json({ error: err.code });
  });
};