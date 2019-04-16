// API keys
const keys = require('./keys');
const redis = require('redis');

const redisClient = redis.createClient({
  host: keys.redisHost,
  port: keys.redisPort,
  retry_strategy: () => 1000
});

// duplicate of redisClient
const sub = redisClient.duplicate();

// Fibonacci recursive -not optimal- function
function fib(index) {
  if (index < 2) return 1;
  return fib(index - 1) + fib(index - 2);
}

// watch redis and every time there is a new value, calculate the fib
// sub for subscription: run callback function channel every time new message
sub.on('message', (channel, message) => {
  // saved in hash called values, the key is the received index (message)
  redisClient.hset('values', message, fib(parseInt(message)));
});

// everytime there is an insert event in redis, call to calculate the Fib
sub.subscribe('insert');
