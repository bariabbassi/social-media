const { db } =  require('../util/admin');

exports.getAllScreams = (req, res) => {
    db.collection('screams').orderBy('createdAt', 'desc').get()
    .then(data => {
        let screams = [];
        data.forEach(doc => {
            screams.push({
                screamId: doc.id,
                ...doc.data()
            });
        })
        return res.json(screams)
    })
    .catch(err => console.error(err))
};

exports.getOneScream = (req, res) => {
    if (req.body.body.trim() === '') {
        return res.status(400).json({ body: 'Body must not be empty' });
    }

    const newScream = {
        userHandle: req.user.handle,
        body: req.body.body,
        createdAt: new Date().toISOString()
    };

    db.collection('screams').add(newScream)
    .then(doc => {return res.json({ message: `document ${doc.id} created successfully`})})
    .catch(err => {
        console.error(err);
        res.status(500).json({ error: err.code });
    });
};
