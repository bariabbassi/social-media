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

    const noImg = 'no-img.png';

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
            imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
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

exports.uploadImage = (req, res) => {
    const BusBoy = require("busboy");
    const path = require("path");
    const os = require("os");
    const fs = require("fs");
  
    const busboy = new BusBoy({ headers: req.headers });

    let imageToBeUploaded = {};
    let imageFileName;
    // String for image token
    let generatedToken = uuid();
  
    busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
      console.log(fieldname, file, filename, encoding, mimetype);
      if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
        return res.status(400).json({ error: "Wrong file type submitted" });
      }
      // my.image.png => ['my', 'image', 'png']
      const imageExtension = filename.split(".")[filename.split(".").length - 1];
      // 32756238461724837.png
      imageFileName = `${Math.round(
        Math.random() * 1000000000000
      ).toString()}.${imageExtension}`;
      const filepath = path.join(os.tmpdir(), imageFileName);
      imageToBeUploaded = { filepath, mimetype };
      file.pipe(fs.createWriteStream(filepath));
    });
    busboy.on("finish", () => {
      admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
            //Generate token to be appended to imageUrl
            firebaseStorageDownloadTokens: generatedToken,
          },
        },
      })
      .then(() => {
        // Append token to url
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media&token=${generatedToken}`;
        return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ message: "image uploaded successfully" });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: "something went wrong" });
      });
  });
  busboy.end(req.rawBody);
};