const { response } = require('express');
const { MongoClient, ObjectId, MongoDBNamespace } = require('mongodb');	// require the mongodb driver

/**
 * Uses mongodb v3.6+ - [API Documentation](http://mongodb.github.io/node-mongodb-native/3.6/api/)
 * Database wraps a mongoDB connection to provide a higher-level abstraction layer
 * for manipulating the objects in our cpen322 app.
 */
function Database(mongoUrl, dbName){
	if (!(this instanceof Database)) return new Database(mongoUrl, dbName);
	this.connected = new Promise((resolve, reject) => {
		MongoClient.connect(
			mongoUrl,
			{
				useNewUrlParser: true
			},
			(err, client) => {
				if (err) reject(err);
				else {
					console.log('[MongoClient] Connected to ' + mongoUrl + '/' + dbName);
					resolve(client.db(dbName));
				}
			}
		)
	});
	this.status = () => this.connected.then(
		db => ({ error: null, url: mongoUrl, db: dbName }),
		err => ({ error: err })
	);
}

Database.prototype.getRooms = function(){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
		
			if (!db){
				reject("database is null");
			}
			else{
				resolve(db.collection("chatrooms").find().toArray());
			}
		})
	)
}

Database.prototype.getRoom = function(room_id){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {

			if (db){
				var doc = db.collection("chatrooms").findOne({_id: room_id});
				resolve(doc);
			}
			else{
				reject("Database does not exist");
			}
		})
	)
}

Database.prototype.addRoom = function(room){
	return this.connected.then(db => 
		new Promise((resolve, reject) => {
			if (db){
				if (!room.name){
					reject("Room name not found");
				}
				else{
				if (!room._id){
					room._id = ObjectId().toString();
				}
				db.collection("chatrooms").insert(room)
				resolve(room);
			}
		}
			else{
				reject("Database does not exist");
			}
		})
	)
}

Database.prototype.getLastConversation = function(room_id, before){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {

				if (!before){
					before = Date.now();
				}

				// https://docs.mongodb.com/realm/mongodb/actions/collection.find/
				const query = {room_id: room_id, timestamp: {$lt: before}};
				const sort = {sort: {timestamp: 1}};

				if(db){
				var convo = db.collection("conversations").find(query, sort).toArray();
				convo.then((convos => {
					if (convos.length > 0){
						resolve(convos[convos.length-1]);
					}
					else{
						resolve(null);
					}     
				}))}
				else{
					reject("Database does not exist");
				}
		})
	)
}

Database.prototype.addConversation = function(conversation){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (db) {
                if (!conversation.room_id || !conversation.timestamp || !conversation.messages) {
                    throw new Error('The conversation has a wrong field');
                }
                conversation._id = ObjectId();
                db.collection('conversations').insertOne(conversation);
                resolve(conversation);
            } else {
                reject('Database does not exist');
            }
		}
		)
	)
}

Database.prototype.getUser = function(username){
	return this.connected.then(db =>
		new Promise((resolve, reject) => {
			if (db){
				var found_username = db.collection('users').findOne({username: username});
				resolve(found_username);
			}
			else{
				reject("The database was not found for getUser");
			}
		})
		)
}

module.exports = Database;