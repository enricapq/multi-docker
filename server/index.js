// run script: node index.js
const keys = require('./keys');

// Express App Setup
// express webserver library
const express = require('express');
const bodyParser = require('body-parser');
// request
const cors = require('cors');

// receive/response http requests coming from React application
const app = express();
app.use(cors());
// turn parsed body of the post request into json
app.use(bodyParser.json());

// Postgres Client Setup
// Pool module from pg library
const { Pool } = require('pg');
const pgClient = new Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort
});
// error listener
pgClient.on('error', () => console.log('Lost PG connection'));

// create table will store all indexes of submitted values
pgClient
  .query('CREATE TABLE IF NOT EXISTS values (number INT)')
  .catch(err => console.log(err));

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  // retry every 1sec
  retry_strategy: () => 1000
});
// create duplicate connection 'cause when a connection is used
// to listen/subscribe/publish info can't be used for other purposes
const redisPublisher = redisClient.duplicate();

// Express route handlers

app.get('/', (req, res) => {
  res.send('Hi');
});

app.get('/values/all', async (req, res) => {
  const values = await pgClient.query('SELECT * from values');

  res.send(values.rows);
});

app.get('/values/current', async (req, res) => {
  redisClient.hgetall('values', (err, values) => {
    res.send(values);
  });
});

app.post('/values', async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send('Index too high');
  }
  // put value in redis and temporarily save string 'Nothing yet'
  // until the worker has calculated the fibonacci value
  redisClient.hset('values', index, 'Nothing yet!');

  // publish a new insert event and wake up worker process
  redisPublisher.publish('insert', index);

  // store permanent record
  pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);

  // response at the end...
  res.send({ working: true });
});

app.listen(5000, err => {
  console.log('Listening');
});
